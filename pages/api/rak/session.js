// POST /api/rak/session { privyToken } -> { token, profile }
// Called by the /rak sign-in page right after Glyph login. Turns a Privy access token into a 30-day game token.
import { cors, body, limit, clientIp, sha, signToken, playerId } from "../../../lib/rak/core";
import { privyConfigured, verifyAccessToken, privyWallets } from "../../../lib/rak/privy";
import { getProfile, newProfile, saveProfile, holdingsFor, applyHoldings, ownView, ranksFor } from "../../../lib/rak/players";

export default async function handler(req, res) {
  if (cors(req, res, "POST")) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "post_only" });
  if (!privyConfigured()) return res.status(503).json({ ok: false, error: "login_not_configured" });
  if (!(await limit("sess:" + sha(clientIp(req)).slice(0, 16), 30, 600))) return res.status(429).json({ ok: false, error: "slow_down" });

  let did;
  try { did = await verifyAccessToken(body(req).privyToken); }
  catch (e) { return res.status(401).json({ ok: false, error: "invalid_login", detail: e.message }); }

  try {
    const pid = playerId(did);
    const wallets = await privyWallets(did);
    const p = (await getProfile(pid)) || newProfile(pid, did, wallets);
    p.wallets = wallets;
    const h = await holdingsFor(p, true).catch(() => null);
    applyHoldings(p, h);
    await saveProfile(p);
    const token = signToken({ pid, did }, 30 * 86400);
    return res.status(200).json({ ok: true, token, profile: ownView(p, h), ranks: await ranksFor(pid) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "session_failed", detail: String(e && e.message) });
  }
}
