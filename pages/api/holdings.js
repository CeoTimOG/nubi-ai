// POST /api/holdings { privyToken, refresh? } -> the operative's vault (see lib/rak/vault.js). The site calls it on
// connect, which also warms the cache that /api/chat reads on every message.
import { cors, body, limit, clientIp, sha } from "../../lib/rak/core";
import { privyConfigured } from "../../lib/rak/privy";
import { getVault } from "../../lib/rak/vault";

export default async function handler(req, res) {
  if (cors(req, res, "POST")) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "post_only" });
  res.setHeader("Cache-Control", "no-store");
  if (!privyConfigured()) return res.status(503).json({ ok: false, error: "login_not_configured" });
  if (!(await limit("vault:" + sha(clientIp(req)).slice(0, 16), 40, 600))) return res.status(429).json({ ok: false, error: "slow_down" });
  const b = body(req);
  try { return res.status(200).json(await getVault(b.privyToken, !!b.refresh)); }
  catch (e) {
    const bad = !!(e && e.auth);
    return res.status(bad ? 401 : 500).json({ ok: false, error: bad ? "invalid_login" : "holdings_failed", detail: String(e && e.message) });
  }
}
