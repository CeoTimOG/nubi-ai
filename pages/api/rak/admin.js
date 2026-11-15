// POST /api/rak/admin  (header x-admin-secret: ADMIN_SECRET)
//   { op: "flags" }                     -> the last 50 rejected runs
//   { op: "remove", pid }               -> take a player off every board
//   { op: "ban", pid } / { op: "unban", pid }
//   { op: "rename", pid, name }
import crypto from "crypto";
import { body, kv } from "../../../lib/rak/core";
import { getProfile, saveProfile, removeFromBoards, cleanName } from "../../../lib/rak/players";

function authorized(req) {
  const want = Buffer.from(String(process.env.ADMIN_SECRET || "")), got = Buffer.from(String(req.headers["x-admin-secret"] || ""));
  return want.length > 0 && want.length === got.length && crypto.timingSafeEqual(want, got);
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "post_only" });
  if (!authorized(req)) return res.status(401).json({ ok: false, error: "unauthorized" });
  const b = body(req), pid = typeof b.pid === "string" && /^p[0-9a-f]{16}$/.test(b.pid) ? b.pid : null;
  try {
    if (b.op === "flags") {
      const list = (await kv("LRANGE", "rak:flags", 0, 49)) || [];
      return res.status(200).json({ ok: true, flags: list.map((s) => { try { return JSON.parse(s); } catch (e) { return s; } }) });
    }
    if (!pid) return res.status(400).json({ ok: false, error: "bad_pid" });
    if (b.op === "remove") { await removeFromBoards(pid); return res.status(200).json({ ok: true }); }
    if (b.op === "ban") { await kv("SET", "rak:ban:" + pid, "1"); await removeFromBoards(pid); return res.status(200).json({ ok: true }); }
    if (b.op === "unban") { await kv("DEL", "rak:ban:" + pid); return res.status(200).json({ ok: true }); }
    if (b.op === "rename") {
      const p = await getProfile(pid), n = cleanName(b.name);
      if (!p || !n) return res.status(400).json({ ok: false, error: "bad_rename" });
      p.name = n; await saveProfile(p);
      return res.status(200).json({ ok: true });
    }
    return res.status(400).json({ ok: false, error: "bad_op" });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "admin_failed", detail: String(e && e.message) });
  }
}
