// POST /api/rak/run
//   { op: "start" }                         -> { runId }        anyone; stamps the server's start time
//   { op: "split", runId, lv }              -> { ok }           a level was cleared (server time is recorded)
//   { op: "finish", runId, stats }          -> { score, posted, best, ranks }
// A guest's finish is scored but not posted, and the run stays open so it can be posted after signing in.
import crypto from "crypto";
import { cors, body, limit, clientIp, sha, readToken, kv, kvJson } from "../../../lib/rak/core";
import { getProfile, checkRun, scoreOf, postRun, ranksFor } from "../../../lib/rak/players";

const RUN = (id) => "rak:run:" + id;
const TTL = 7 * 86400;
const validId = (id) => typeof id === "string" && /^[A-Za-z0-9_-]{16,32}$/.test(id);

export default async function handler(req, res) {
  if (cors(req, res, "POST")) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "post_only" });
  res.setHeader("Cache-Control", "no-store");
  const b = body(req), ip = sha(clientIp(req)).slice(0, 16);
  try {
    if (b.op === "start") {
      if (!(await limit("run:" + ip, 60, 3600))) return res.status(429).json({ ok: false, error: "slow_down" });
      const runId = crypto.randomBytes(12).toString("base64url");
      await kv("SET", RUN(runId), JSON.stringify({ t: Date.now(), ip, splits: [] }), "EX", TTL);
      return res.status(200).json({ ok: true, runId });
    }
    if (!validId(b.runId)) return res.status(400).json({ ok: false, error: "bad_run" });
    const run = await kvJson(RUN(b.runId));
    if (!run) return res.status(404).json({ ok: false, error: "unknown_run" });

    if (b.op === "split") {
      const lv = Number(b.lv);
      if (!(lv >= 1 && lv <= 6) || run.splits.length >= 12) return res.status(400).json({ ok: false, error: "bad_split" });
      run.splits.push({ lv, at: Date.now() });
      await kv("SET", RUN(b.runId), JSON.stringify(run), "KEEPTTL");
      return res.status(200).json({ ok: true });
    }
    if (b.op !== "finish") return res.status(400).json({ ok: false, error: "bad_op" });

    const c = checkRun(b.stats, run);
    if (c.error) {
      await kv("LPUSH", "rak:flags", JSON.stringify({ at: Date.now(), runId: b.runId, why: c.error, stats: JSON.stringify(b.stats || null).slice(0, 1500) })).catch(() => {});
      await kv("LTRIM", "rak:flags", 0, 499).catch(() => {});
      return res.status(422).json({ ok: false, error: "run_rejected", reason: c.error });
    }
    const st = c.stats, t = readToken(req);
    if (!t) return res.status(200).json({ ok: true, posted: false, reason: "guest", score: scoreOf(st) });

    if (!(await limit("fin:" + t.pid, 40, 3600))) return res.status(429).json({ ok: false, error: "slow_down" });
    if (await kv("GET", "rak:ban:" + t.pid)) return res.status(200).json({ ok: true, posted: false, reason: "not_eligible", score: scoreOf(st) });
    const first = await kv("SET", RUN(b.runId) + ":done", t.pid, "NX", "EX", TTL);
    if (!first) return res.status(409).json({ ok: false, error: "already_posted" });

    const p = await getProfile(t.pid);
    if (!p) return res.status(401).json({ ok: false, error: "sign_in" });
    const r = await postRun(p, st);
    return res.status(200).json({ ok: true, posted: true, score: r.score, best: r.best, fullClear: st.fullClear, stats: p.stats, ranks: await ranksFor(t.pid) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "run_failed", detail: String(e && e.message) });
  }
}
