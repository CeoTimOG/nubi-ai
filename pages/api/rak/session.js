// POST /api/rak/session { privyToken } -> { token, profile }
// Called by the /rak sign-in page right after Glyph login. Turns a Privy access token into a 30-day game token.
import { cors, body, limit, clientIp, sha, signToken, playerId } from "../../../lib/rak/core";
import { privyConfigured, verifyAccessToken, privyWallets } from "../../../lib/rak/privy";
import { glyphProfile } from "../../../lib/rak/glyph";
import { getProfile, newProfile, saveProfile, holdingsFor, applyHoldings, ownView, ranksFor, cleanName } from "../../../lib/rak/players";

export default async function handler(req, res) {
  if (cors(req, res, "POST")) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "post_only" });
  if (!privyConfigured()) return res.status(503).json({ ok: false, error: "login_not_configured" });
  if (!(await limit("sess:" + sha(clientIp(req)).slice(0, 16), 60, 600))) return res.status(429).json({ ok: false, error: "slow_down" });

  let did; const privyToken = body(req).privyToken;
  try { did = await verifyAccessToken(privyToken); }
  catch (e) { return res.status(401).json({ ok: false, error: "invalid_login", detail: e.message }); }

  try {
    const pid = playerId(did);
    const wallets = await privyWallets(did).catch((e) => { throw new Error("wallets: " + e.message + (/401|403/.test(e.message) ? " (PRIVY_APP_SECRET not accepted)" : "")); });
    // Add the wallets linked inside Glyph. If Glyph can't be reached, sign-in still works with the Glyph wallets.
    const g = await glyphProfile(privyToken, wallets.glyph).catch(() => null);
    if (g) g.linked.forEach((a) => { if (!wallets.some((w) => w.address === a)) wallets.push({ address: a, kind: "glyph-linked" }); });
    const p = (await getProfile(pid)) || newProfile(pid, did, wallets);
    if (g && g.name && /^Nubi [0-9A-F]{4}$/.test(p.name)) { const n = cleanName(g.name); if (n) p.name = n; }   // use their Glyph name
    p.wallets = wallets.slice(0, 12);
    const h = await holdingsFor(p, true).catch(() => null);
    applyHoldings(p, h);
    await saveProfile(p);
    const token = signToken({ pid, did }, 30 * 86400);
    return res.status(200).json({ ok: true, token, profile: ownView(p, h), ranks: await ranksFor(pid) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "session_failed", detail: String(e && e.message) });
  }
}
