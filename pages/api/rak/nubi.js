// POST /api/rak/nubi { messages: [{role, content}], game: {...} } -> { reply }
// Nubi inside RAK 3022: the same character and lore as nubi.rareapepes.com, plus the game's field manual and
// the player's live game state. The persona, manual and lore are sent as one cached block to keep costs down.
import { cors, body, limit, clientIp, sha, readToken, kv } from "../../../lib/rak/core";
import { NUBI_SYSTEM } from "../../../lib/nubi-persona";
import { IN_GAME, gameContext } from "../../../lib/rak/guide";
import { getProfile } from "../../../lib/rak/players";
import { COLLECTIONS } from "../../../lib/rak/holdings";

const MODEL = "claude-haiku-4-5-20251001";

function cleanMessages(list) {
  const out = [];
  for (const m of Array.isArray(list) ? list.slice(-8) : []) {
    const role = m && (m.role === "assistant" ? "assistant" : m.role === "user" ? "user" : null);
    const content = m && typeof m.content === "string" ? m.content.trim().slice(0, 700) : "";
    if (!role || !content) continue;
    if (out.length && out[out.length - 1].role === role) out[out.length - 1].content += "\n" + content;
    else out.push({ role, content });
  }
  while (out.length && out[0].role !== "user") out.shift();
  return out.length && out[out.length - 1].role === "user" ? out : null;
}

export default async function handler(req, res) {
  if (cors(req, res, "POST")) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "post_only" });
  if (!process.env.ANTHROPIC_API_KEY) return res.status(503).json({ ok: false, error: "nubi_offline" });
  res.setHeader("Cache-Control", "no-store");

  const b = body(req), t = readToken(req);
  const who = t ? "u:" + t.pid : "ip:" + sha(clientIp(req)).slice(0, 16);
  if (!(await limit("nubi:" + who, t ? 120 : 40, 3600))) {
    return res.status(429).json({ ok: false, error: "slow_down", reply: "Comms are hot, operative. Give me a minute, then ask again." });
  }
  const messages = cleanMessages(b.messages);
  if (!messages) return res.status(400).json({ ok: false, error: "bad_messages" });

  try {
    const [lore, p] = await Promise.all([kv("GET", "nubi:lore").catch(() => null), t ? getProfile(t.pid).catch(() => null) : null]);
    let fixed = NUBI_SYSTEM + "\n" + IN_GAME;
    if (lore && String(lore).trim()) fixed += `\n=== NUBI FIELD INTEL (current, owner-verified — treat as canon) ===\n${String(lore).trim()}`;
    const player = p && {
      name: p.name, stats: p.stats,
      holds: COLLECTIONS.filter((c) => p.badges && p.badges[c.key]).map((c) => p.badges[c.key] + " " + c.name).join(", "),
    };
    const r = await fetch((process.env.ANTHROPIC_API_URL || "https://api.anthropic.com") + "/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": process.env.ANTHROPIC_API_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 450,
        system: [
          { type: "text", text: fixed, cache_control: { type: "ephemeral" } },
          { type: "text", text: gameContext(b.game, player) },
        ],
        messages,
      }),
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) return res.status(502).json({ ok: false, error: "nubi_unavailable", detail: data && data.error && data.error.message });
    const text = ((data.content || []).find((c) => c.type === "text") || {}).text || "";
    const reply = text.replace(/\[[A-Z][A-Z_]{2,}(:[^\]]*)?\]/g, "").replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
    return res.status(200).json({ ok: true, reply: reply || "..." });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "nubi_failed", detail: String(e && e.message) });
  }
}
