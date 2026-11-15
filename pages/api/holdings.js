// POST /api/holdings { privyToken, refresh? } -> what the signed-in operative holds: their Glyph wallet plus every
// wallet linked to it (in Privy or inside Glyph), across Rare Apepes, Zombie Apepes, Apepe Odyssey and Apepe Loot.
// Used by the Nubi chat so Nubi can answer "what's in my wallet?". Cached for 10 minutes per player.
import { cors, body, limit, clientIp, sha, kv, kvJson, playerId } from "../../lib/rak/core";
import { privyConfigured, verifyAccessToken, privyWallets } from "../../lib/rak/privy";
import { glyphProfile } from "../../lib/rak/glyph";
import { fetchHoldings, COLLECTIONS } from "../../lib/rak/holdings";

export default async function handler(req, res) {
  if (cors(req, res, "POST")) return;
  if (req.method !== "POST") return res.status(405).json({ ok: false, error: "post_only" });
  res.setHeader("Cache-Control", "no-store");
  if (!privyConfigured()) return res.status(503).json({ ok: false, error: "login_not_configured" });
  if (!(await limit("vault:" + sha(clientIp(req)).slice(0, 16), 40, 600))) return res.status(429).json({ ok: false, error: "slow_down" });
  const b = body(req);
  let did;
  try { did = await verifyAccessToken(b.privyToken); }
  catch (e) { return res.status(401).json({ ok: false, error: "invalid_login", detail: e.message }); }
  const key = "nubi:vault:" + playerId(did);
  try {
    if (!b.refresh) { const hit = await kvJson(key).catch(() => null); if (hit) return res.status(200).json({ ...hit, cached: true }); }
    const wallets = await privyWallets(did);
    const g = await glyphProfile(b.privyToken, wallets.glyph).catch(() => null);
    if (g) g.linked.forEach((a) => { if (!wallets.some((w) => w.address === a)) wallets.push({ address: a, kind: "glyph-linked" }); });
    const list = wallets.slice(0, 12);
    const h = await fetchHoldings(list.map((w) => w.address));
    const out = {
      ok: !!h.ok, reason: h.reason || null, name: (g && g.name) || null,
      wallets: list.map((w) => ({ address: w.address, kind: w.kind })),
      collections: COLLECTIONS.map(({ key: k, name }) => ({ key: k, name, slug: (h.slugs && h.slugs[k]) || null })),
      counts: h.counts || {}, items: (h.items || []).map(({ c, id, name, img }) => ({ c, id, name, img })), updated: Date.now(),
    };
    if (out.ok) await kv("SET", key, JSON.stringify(out), "EX", 600).catch(() => {});
    return res.status(200).json(out);
  } catch (e) {
    return res.status(500).json({ ok: false, error: "holdings_failed", detail: String(e && e.message) });
  }
}
