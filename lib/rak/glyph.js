// Wallets the player linked inside Glyph (for example a MetaMask wallet holding their Apepes). Glyph keeps these
// itself, not in our Privy app, so we ask Glyph's API the same way the Glyph widget does: with the player's own Privy
// access token and their Glyph main wallet. The answer comes from Glyph, not from the browser, so it can be trusted.
const GLYPH = (process.env.GLYPH_API_URL || "https://useglyph.io").replace(/\/$/, "");   // override only for local tests
const ok = (a) => /^0x[0-9a-f]{40}$/.test(a);

export async function glyphProfile(privyToken, glyphWallet) {
  if (!privyToken || !glyphWallet) return null;
  const r = await fetch(GLYPH + "/api/widget/user", {
    headers: { Authorization: "Bearer " + privyToken, "x-evm-address": glyphWallet, "Content-Type": "application/json", Origin: "https://nubi.rareapepes.com" },
  });
  if (!r.ok) throw new Error("glyph_user_" + r.status);
  const j = await r.json();
  const u = (j && (j.user || j.data)) || j || {};
  const own = [u.evmWallet, u.smartWallet].map((a) => String(a || "").toLowerCase());
  if (!own.includes(glyphWallet)) throw new Error("glyph_user_mismatch");          // never trust another player's list
  const linked = (Array.isArray(u.linkedWallets) ? u.linkedWallets : []).map((w) => String((w && w.address) || "").toLowerCase()).filter(ok);
  return { name: typeof u.name === "string" ? u.name : "", picture: typeof u.picture === "string" ? u.picture : "", linked: [...new Set(linked)].slice(0, 8) };
}
