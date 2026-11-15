// The operative's vault: every Apepe NFT across their Glyph wallet and every wallet linked to it (in Privy or inside
// Glyph), read live from OpenSea and cached for 10 minutes. Used by /api/holdings (the site) and /api/chat (Nubi).
import { kv, kvJson, playerId } from "./core";
import { verifyAccessToken, privyWallets } from "./privy";
import { glyphProfile } from "./glyph";
import { fetchHoldings, COLLECTIONS } from "./holdings";

export async function getVault(privyToken, refresh) {
  let did;
  try { did = await verifyAccessToken(privyToken); }
  catch (e) { throw Object.assign(new Error("invalid_login: " + e.message), { auth: true }); }
  const key = "nubi:vault:" + playerId(did);
  if (!refresh) { const hit = await kvJson(key).catch(() => null); if (hit) return { ...hit, cached: true }; }
  const wallets = await privyWallets(did);
  let glyphNote = null;
  const g = await glyphProfile(privyToken, wallets.glyph).catch((e) => { glyphNote = e.message; return null; });
  if (g) g.linked.forEach((a) => { if (!wallets.some((w) => w.address === a)) wallets.push({ address: a, kind: "glyph-linked" }); });
  const list = wallets.slice(0, 12);
  const h = await fetchHoldings(list.map((w) => w.address));
  const out = {
    ok: !!h.ok, reason: h.reason || null, partial: h.partial || null, glyph: g ? "ok" : glyphNote || "no_glyph_wallet", name: (g && g.name) || null,
    wallets: list.map((w) => ({ address: w.address, kind: w.kind })),
    collections: COLLECTIONS.map(({ key: k, name }) => ({ key: k, name, slug: (h.slugs && h.slugs[k]) || null })),
    counts: h.counts || {}, items: (h.items || []).map(({ c, id, name, img }) => ({ c, id, name, img })), updated: Date.now(),
  };
  if (out.ok && !out.partial) await kv("SET", key, JSON.stringify(out), "EX", 600).catch(() => {});
  return out;
}

const KIND = { glyph: "Glyph", "glyph-linked": "linked in Glyph", linked: "linked", embedded: "embedded", smart: "smart wallet" };
const short = (a) => a.slice(0, 6) + "..." + a.slice(-4);

// Placed last in Nubi's instructions so it wins over older memory notes or earlier replies in the chat.
export function vaultBlock(v) {
  if (!v) return "";
  if (!v.ok) {
    return "\n\n=== LIVE VAULT SCAN: FAILED THIS TIME (" + (v.reason || v.error || "unknown") + ") ===\n" +
      "The interface tried to read their wallets and the read failed. If they ask what they hold, say the scan didn't come back this time and to try again in a minute. Do not claim you can never read wallets.";
  }
  const lines = ["", "", "=== LIVE VAULT SCAN (pulled for you on this message: their connected Glyph wallet plus every wallet linked to it, read from the chain via OpenSea) ==="];
  lines.push("Wallets scanned: " + v.wallets.map((w) => short(w.address) + " (" + (KIND[w.kind] || w.kind) + ")").join(", "));
  let total = 0;
  (v.collections || []).forEach((c) => {
    const ids = v.items.filter((it) => it.c === c.key).map((it) => "#" + it.id), n = v.counts[c.key] || 0; total += n;
    lines.push(c.name + (c.slug ? " (slug " + c.slug + ")" : "") + ": " + n + (n ? ": " + ids.slice(0, 80).join(", ") + (n > 80 ? ", and more" : "") : ""));
  });
  lines.push("Total: " + total + " NFTs across the Rare Apepes Memetic Universe collections.");
  if (v.partial) lines.push("Note: part of the scan didn't come back, so the real total may be a little higher.");
  lines.push("You CAN read their wallets now: this scan is real-time and it overrides anything earlier in this conversation or in your memory notes saying you can't. " +
    "When they ask what they hold, answer from this scan with exact counts and token numbers. To show one, use [SHOW_NFT:slug:tokenId] with the slug above. Only quote full wallet addresses if they ask.");
  return lines.join("\n");
}
