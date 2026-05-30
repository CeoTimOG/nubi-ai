// pages/api/nft.js — fetch a single NFT (image + traits) by collection slug + token id.
// Blocks NSFW collections. Always returns 200; never breaks the app.
function isSlug(s) { return typeof s === "string" && /^[a-z0-9-]{1,80}$/i.test(s); }
function isId(s) { return typeof s === "string" && /^[0-9]{1,78}$/.test(s); }
async function osGet(url, key) { return fetch(url, { headers: { accept: "application/json", "x-api-key": key } }); }

export default async function handler(req, res) {
  const key = process.env.OPENSEA_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: "no_key" });
  const slug = (req.query && req.query.slug ? String(req.query.slug) : "").toLowerCase().trim();
  const id = (req.query && req.query.id ? String(req.query.id) : "").trim();
  if (!isSlug(slug)) return res.status(200).json({ ok: false, reason: "bad_slug" });
  if (!isId(id)) return res.status(200).json({ ok: false, reason: "bad_id" });

  try {
    // collection meta -> contract, chain, nsfw flag
    const mr = await osGet(`https://api.opensea.io/api/v2/collections/${slug}`, key);
    if (!mr.ok) return res.status(200).json({ ok: false, reason: "not_found", slug });
    const md = await mr.json();
    if (md.is_nsfw === true) return res.status(200).json({ ok: false, reason: "nsfw", slug });
    const c0 = md.contracts && md.contracts[0];
    const contract = c0 && c0.address;
    const chain = (c0 && c0.chain) || "ethereum";
    if (!contract) return res.status(200).json({ ok: false, reason: "no_contract", slug });

    // single NFT
    const nr = await osGet(`https://api.opensea.io/api/v2/chain/${chain}/contract/${contract}/nfts/${id}`, key);
    if (!nr.ok) return res.status(200).json({ ok: false, reason: "nft_http_" + nr.status, slug, id });
    const nd = await nr.json();
    const n = nd && nd.nft;
    if (!n) return res.status(200).json({ ok: false, reason: "nft_no_data", slug, id });

    const traits = Array.isArray(n.traits)
      ? n.traits.slice(0, 8).map(t => ({ type: t.trait_type, value: t.value }))
      : [];
    return res.status(200).json({
      ok: true,
      slug, id,
      name: n.name || ((md.name || slug) + " #" + id),
      image: n.display_image_url || n.image_url || null,
      permalink: n.opensea_url || ("https://opensea.io/assets/" + chain + "/" + contract + "/" + id),
      traits,
      collectionName: md.name || slug,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: "error" });
  }
}
