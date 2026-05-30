// pages/api/collection.js — live data + images for ANY OpenSea collection by slug.
// Blocks NSFW-flagged collections. Always returns 200; never breaks the app.
function isSlug(s) { return typeof s === "string" && /^[a-z0-9-]{1,80}$/i.test(s); }

async function osGet(url, key) {
  const r = await fetch(url, { headers: { accept: "application/json", "x-api-key": key } });
  return r;
}

async function getMeta(slug, key) {
  try {
    const r = await osGet(`https://api.opensea.io/api/v2/collections/${slug}`, key);
    if (!r.ok) return { metaReason: "meta_http_" + r.status };
    const d = await r.json();
    return {
      name: d.name || slug,
      isNsfw: d.is_nsfw === true,
      contract: (d.contracts && d.contracts[0] && d.contracts[0].address) || null,
      image: d.image_url || null,
    };
  } catch (e) { return { metaReason: "meta_error" }; }
}

async function getStats(slug, key) {
  try {
    const r = await osGet(`https://api.opensea.io/api/v2/collections/${slug}/stats`, key);
    if (!r.ok) return { statsReason: "stats_http_" + r.status };
    const d = await r.json();
    const t = d && d.total;
    if (!t) return { statsReason: "stats_no_data" };
    return { floorEth: t.floor_price ?? null, ownerCount: t.num_owners ?? null, volumeAll: t.volume ?? null, salesAll: t.sales ?? null };
  } catch (e) { return { statsReason: "stats_error" }; }
}

async function getSales(slug, key, contract) {
  try {
    const r = await osGet(`https://api.opensea.io/api/v2/events/collection/${slug}?event_type=sale&limit=12`, key);
    if (!r.ok) return { salesReason: "events_http_" + r.status };
    const d = await r.json();
    const events = (d && d.asset_events) || [];
    const recentSales = events.map((e) => {
      let priceEth = null;
      const pay = e.payment;
      if (pay && pay.quantity != null) {
        const dec = pay.decimals != null ? pay.decimals : 18;
        priceEth = Number(pay.quantity) / Math.pow(10, dec);
      }
      const tokenId = (e.nft && e.nft.identifier) || (e.asset && e.asset.identifier) || null;
      const name = (e.nft && e.nft.name) || (e.asset && e.asset.name) || null;
      const image = (e.nft && (e.nft.display_image_url || e.nft.image_url)) || (e.asset && (e.asset.display_image_url || e.asset.image_url)) || null;
      const permalink = (e.nft && e.nft.opensea_url) || (contract && tokenId != null ? ("https://opensea.io/assets/ethereum/" + contract + "/" + tokenId) : null);
      return { tokenId, name, image, permalink, priceEth: priceEth != null ? Number(priceEth.toFixed(4)) : null, symbol: (pay && pay.symbol) || "ETH", time: e.event_timestamp || e.closing_date || null };
    });
    return { recentSales };
  } catch (e) { return { salesReason: "events_error" }; }
}

export default async function handler(req, res) {
  const key = process.env.OPENSEA_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: "no_key" });
  const slug = (req.query && req.query.slug ? String(req.query.slug) : "").toLowerCase().trim();
  if (!isSlug(slug)) return res.status(200).json({ ok: false, reason: "bad_slug" });

  const meta = await getMeta(slug, key);
  if (meta.metaReason && !meta.name) return res.status(200).json({ ok: false, reason: "not_found", slug });
  if (meta.isNsfw) return res.status(200).json({ ok: false, reason: "nsfw", slug });

  const [stats, sales] = await Promise.all([getStats(slug, key), getSales(slug, key, meta.contract)]);
  return res.status(200).json({ ok: true, slug, name: meta.name, contract: meta.contract, image: meta.image, ...stats, ...sales });
}
