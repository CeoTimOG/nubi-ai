// Player profiles, the score formula, run checks and the leaderboards (Upstash sorted sets).
import { kv, kvJson, kvPipe } from "./core";
import { COLLECTIONS, fetchHoldings } from "./holdings";

// ---- score ------------------------------------------------------------------------------------------
// The game page shows the same formula (shell/hub.js), so keep the two in step.
export const SCORE = { kill: 100, coin: 10, apepe: 250, artifact: 1500, boss: 5000, level: 10000, death: -500, parSec: 3600, perSecUnderPar: 20 };
export function scoreOf(s) {
  let v = s.kills * SCORE.kill + s.coins * SCORE.coin + s.apepes * SCORE.apepe + s.artifacts * SCORE.artifact +
    s.bosses * SCORE.boss + s.levels.length * SCORE.level + s.deaths * SCORE.death;
  if (s.fullClear) v += Math.max(0, SCORE.parSec - Math.floor(s.ms / 1000)) * SCORE.perSecUnderPar;   // full clears only
  return Math.max(0, Math.round(v));
}

// ---- boards -----------------------------------------------------------------------------------------
// score: best run. speed: fastest full clear (level 1 to the end of level 6 in one run). kills/coins/bosses/apepes:
// lifetime totals. lvl1..lvl6: fastest time on each level.
export const BOARDS = {
  score: { label: "Score", asc: false, weekly: true },
  speed: { label: "Speedrun", asc: true, weekly: true, time: true },
  kills: { label: "Enemies", asc: false },
  coins: { label: "RARE coins", asc: false },
  bosses: { label: "Bosses", asc: false },
  apepes: { label: "Apepes", asc: false },
};
for (let i = 1; i <= 6; i++) BOARDS["lvl" + i] = { label: "Level " + i, asc: true, time: true };
export function weekTag(t = Date.now()) {                 // ISO week, UTC
  const d = new Date(t); d.setUTCHours(0, 0, 0, 0); d.setUTCDate(d.getUTCDate() + 4 - (d.getUTCDay() || 7));
  const y = d.getUTCFullYear(), w = Math.ceil(((d - Date.UTC(y, 0, 1)) / 864e5 + 1) / 7);
  return y + "w" + String(w).padStart(2, "0");
}
export const boardKey = (b, period) => "rak:lb:" + b + ":" + (period === "week" ? weekTag() : "all");

// ---- profiles ---------------------------------------------------------------------------------------
const PROF = (pid) => "rak:prof:" + pid;
const HOLD = (pid) => "rak:hold:" + pid;
export const PUB = "rak:pub";

export const getProfile = (pid) => kvJson(PROF(pid));
export function newProfile(pid, did, wallets) {
  const tail = (wallets[0] && wallets[0].address.slice(-4).toUpperCase()) || pid.slice(-4).toUpperCase();
  return { pid, did, name: "Nubi " + tail, avatar: null, wallets: [], badges: {}, created: Date.now(), stats: emptyStats() };
}
export function emptyStats() {
  return { runs: 0, wins: 0, kills: 0, coins: 0, bosses: 0, apepes: 0, artifacts: 0, deaths: 0, playMs: 0, bestScore: 0, bestSpeedMs: 0, levelBest: {} };
}
export function cleanName(s) {
  const n = String(s || "").normalize("NFKC").replace(/[^\p{L}\p{N} _.\-]/gu, "").replace(/\s+/g, " ").trim().slice(0, 18);
  return n.length >= 3 ? n : null;
}
// What other players see on the boards.
export function publicCard(p) {
  const b = {};
  COLLECTIONS.forEach((c) => { if (p.badges && p.badges[c.key] > 0) b[c.key] = p.badges[c.key]; });
  return { n: p.name, i: (p.avatar && p.avatar.img) || null, a: (p.avatar && p.avatar.name) || null, b };
}
export async function saveProfile(p) {
  await kvPipe([["SET", PROF(p.pid), JSON.stringify(p)], ["HSET", PUB, p.pid, JSON.stringify(publicCard(p))]]);
}
// Holdings are cached for 15 minutes; refresh=true reads OpenSea again.
export async function holdingsFor(p, refresh) {
  if (!refresh) { const c = await kvJson(HOLD(p.pid)).catch(() => null); if (c) return c; }
  const h = await fetchHoldings(p.wallets.map((w) => w.address));
  if (h.ok) await kv("SET", HOLD(p.pid), JSON.stringify(h), "EX", 900).catch(() => {});
  return h;
}
// Keep the profile in line with what the wallets hold now.
export function applyHoldings(p, h) {
  if (!h || !h.ok) return p;
  p.badges = {}; COLLECTIONS.forEach((c) => { if (h.counts[c.key]) p.badges[c.key] = h.counts[c.key]; });
  if (p.avatar && !h.items.some((it) => it.c === p.avatar.c && it.id === p.avatar.id)) p.avatar = null;
  return p;
}
// The profile as the player's own game sees it.
export function ownView(p, h) {
  return {
    pid: p.pid, name: p.name, avatar: p.avatar, badges: p.badges, stats: p.stats,
    wallets: p.wallets.map((w) => ({ address: w.address, kind: w.kind })),
    holdings: h ? { ok: h.ok, reason: h.reason || null, items: h.items || [], counts: h.counts || {}, updated: h.updated } : null,
    collections: COLLECTIONS.map(({ key, name, short }) => ({ key, name, short })),
  };
}
export async function ranksFor(pid) {
  const keys = ["score", "speed"].map((b) => boardKey(b, "all"));
  const r = await kvPipe([["ZREVRANK", keys[0], pid], ["ZRANK", keys[1], pid]]).catch(() => [null, null]);
  return { score: r[0] == null ? null : r[0] + 1, speed: r[1] == null ? null : r[1] + 1 };
}

// ---- run checks -------------------------------------------------------------------------------------
// Stats come from the player's browser, so they are checked against the server's own clock and against what a
// run of that length could plausibly contain. This stops casual tampering, not a determined cheater.
const int = (v, lo, hi) => (Number.isInteger(v) && v >= lo && v <= hi ? v : null);
export function checkRun(raw, run, now = Date.now()) {
  const s = raw || {};
  const out = {
    ms: int(s.ms, 1000, 6 * 3600e3), pausedMs: int(s.pausedMs || 0, 0, 3 * 3600e3),
    kills: int(s.kills, 0, 9999), coins: int(s.coins, 0, 99999), bosses: int(s.bosses, 0, 6), artifacts: int(s.artifacts, 0, 6),
    apepes: int(s.apepes || 0, 0, 999), deaths: int(s.deaths, 0, 9999),
    startLevel: int(s.startLevel || 1, 1, 6), fromStart: s.fromStart === true,
    result: ["won", "over", "quit"].includes(s.result) ? s.result : "quit", levels: [],
  };
  for (const k of Object.keys(out)) if (out[k] === null) return { error: "bad_" + k };
  const seen = new Set(); let sum = 0;
  for (const l of Array.isArray(s.levels) ? s.levels.slice(0, 6) : []) {
    const lv = int(l && l.lv, 1, 6), ms = int(l && l.ms, 5000, 6 * 3600e3);
    if (lv === null || ms === null || seen.has(lv)) return { error: "bad_levels" };
    seen.add(lv); sum += ms; out.levels.push({ lv, ms });
  }
  const sec = out.ms / 1000, wall = now - run.t, n = out.levels.length;
  if (out.ms + out.pausedMs > wall + 120e3) return { error: "longer_than_session" };
  if (sum > out.ms + 5000) return { error: "levels_exceed_run" };
  if (out.kills > 20 + sec * 3) return { error: "kills_rate" };
  if (out.coins > 100 + sec * 15) return { error: "coins_rate" };
  if (out.apepes > 30 * (n + 1)) return { error: "apepes_count" };
  if (out.bosses > n + 1 || out.artifacts > n + 1) return { error: "bosses_or_artifacts" };
  // A full clear: all six levels, started from level 1, and not faster than the server saw the levels go by.
  out.fullClear = out.result === "won" && out.fromStart && n === 6 && out.ms >= 60e3;
  const splits = Array.isArray(run.splits) ? run.splits : [];
  // A level time goes on its board only if the server saw that level end, no sooner than the claimed time allows.
  const seenAt = {}; let prev = run.t;
  splits.forEach((sp) => { if (!seenAt[sp.lv]) seenAt[sp.lv] = { at: sp.at, from: prev }; prev = sp.at; });
  out.levels.forEach((l) => { const sp = seenAt[l.lv]; l.ok = !!sp && l.ms >= sp.at - sp.from - out.pausedMs - 90e3; });
  if (out.fullClear && splits.length >= 6) {
    const seenMs = splits[splits.length - 1].at - run.t - out.pausedMs;
    if (out.ms < seenMs - 30e3) out.fullClear = false;
  }
  return { stats: out };
}

// Writes a checked run to the profile and the boards. Returns what changed.
export async function postRun(p, st) {
  const score = scoreOf(st), S = p.stats = { ...emptyStats(), ...(p.stats || {}) };
  const best = { score: score > S.bestScore, speed: st.fullClear && (!S.bestSpeedMs || st.ms < S.bestSpeedMs), levels: [] };
  S.runs++; if (st.fullClear) S.wins++;
  S.kills += st.kills; S.coins += st.coins; S.bosses += st.bosses; S.apepes += st.apepes; S.artifacts += st.artifacts; S.deaths += st.deaths; S.playMs += st.ms;
  if (best.score) S.bestScore = score;
  if (best.speed) S.bestSpeedMs = st.ms;
  st.levels.forEach((l) => { if (l.ok && (!S.levelBest[l.lv] || l.ms < S.levelBest[l.lv])) { S.levelBest[l.lv] = l.ms; best.levels.push(l.lv); } });
  const pid = p.pid, wk = (b) => boardKey(b, "week"), all = (b) => boardKey(b, "all"), cmds = [];
  if (score > 0) cmds.push(["ZADD", all("score"), "GT", score, pid], ["ZADD", wk("score"), "GT", score, pid], ["EXPIRE", wk("score"), 21 * 86400]);
  if (st.fullClear) cmds.push(["ZADD", all("speed"), "LT", st.ms, pid], ["ZADD", wk("speed"), "LT", st.ms, pid], ["EXPIRE", wk("speed"), 21 * 86400]);
  [["kills", st.kills], ["coins", st.coins], ["bosses", st.bosses], ["apepes", st.apepes]].forEach(([b, v]) => { if (v > 0) cmds.push(["ZINCRBY", all(b), v, pid]); });
  st.levels.forEach((l) => { if (l.ok) cmds.push(["ZADD", all("lvl" + l.lv), "LT", l.ms, pid]); });
  cmds.push(["SET", PROF(pid), JSON.stringify(p)], ["HSET", PUB, pid, JSON.stringify(publicCard(p))]);
  await kvPipe(cmds);
  return { score, best };
}

export async function removeFromBoards(pid) {
  const cmds = [];
  Object.keys(BOARDS).forEach((b) => { cmds.push(["ZREM", boardKey(b, "all"), pid]); if (BOARDS[b].weekly) cmds.push(["ZREM", boardKey(b, "week"), pid]); });
  await kvPipe(cmds);
}
