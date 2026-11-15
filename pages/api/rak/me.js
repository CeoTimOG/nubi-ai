// GET  /api/rak/me[?refresh=1]           -> the signed-in player's profile, holdings and ranks
// POST /api/rak/me { name?, avatar? }    -> rename, or pick the NFT used as the player card (avatar: {c, id} or null)
import { cors, body, limit, readToken } from "../../../lib/rak/core";
import { getProfile, saveProfile, holdingsFor, applyHoldings, ownView, ranksFor, cleanName } from "../../../lib/rak/players";

export default async function handler(req, res) {
  if (cors(req, res, "GET, POST")) return;
  const t = readToken(req);
  if (!t) return res.status(401).json({ ok: false, error: "sign_in" });
  res.setHeader("Cache-Control", "no-store");
  try {
    const p = await getProfile(t.pid);
    if (!p) return res.status(401).json({ ok: false, error: "sign_in" });

    if (req.method === "GET") {
      const refresh = req.query.refresh === "1" && (await limit("hold:" + t.pid, 6, 600));
      const h = await holdingsFor(p, refresh).catch(() => null);
      if (refresh && h && h.ok) { applyHoldings(p, h); await saveProfile(p); }
      return res.status(200).json({ ok: true, profile: ownView(p, h), ranks: await ranksFor(t.pid) });
    }
    if (req.method !== "POST") return res.status(405).json({ ok: false, error: "method" });
    if (!(await limit("me:" + t.pid, 30, 600))) return res.status(429).json({ ok: false, error: "slow_down" });

    const b = body(req);
    const h = await holdingsFor(p, false).catch(() => null);
    if (b.name !== undefined) {
      const n = cleanName(b.name);
      if (!n) return res.status(400).json({ ok: false, error: "name_3_to_18_letters_or_numbers" });
      p.name = n;
    }
    if (b.avatar !== undefined) {
      if (b.avatar === null) p.avatar = null;
      else {
        const it = h && h.items && h.items.find((x) => x.c === String(b.avatar.c) && x.id === String(b.avatar.id));
        if (!it) return res.status(400).json({ ok: false, error: "not_in_your_wallets" });
        p.avatar = { c: it.c, id: it.id, name: it.name, img: it.img };
      }
    }
    await saveProfile(p);
    return res.status(200).json({ ok: true, profile: ownView(p, h) });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "profile_failed", detail: String(e && e.message) });
  }
}
