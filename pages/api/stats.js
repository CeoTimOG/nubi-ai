// pages/api/stats.js — live read-only collection data via OpenSea API v2.
// Returns floor/holders/volume + recent sales. Always 200; never breaks the app.
const SLUG = "rare-apepes";
const CONTRACT = "0x31d45de84fde2fb36575085e05754a4932dd5170";

async function getStats(key) {
  try {
    const r = await fetch(`https://api.opensea.io/api/v2/collections/${SLUG}/stats`, {
      headers: { accept: "application/json", "x-api-key": key },
    });
    if (!r.ok) return { reason: "stats_http_" + r.status };
    const data = await r.json();
    const t = data && data.total;
    if (!t) return { reason: "stats_no_data" };
    return {
      floorEth: t.floor_price ?? null,
      ownerCount: t.num_owners ?? null,
      volumeAll: t.volume ?? null,
      salesAll: t.sales ?? null,
    };
  } catch (e) {
    return { reason: "stats_error" };
  }
}

async function getRecentSales(key) {
  try {
    const r = await fetch(
      `https://api.opensea.io/api/v2/events/collection/${SLUG}?event_type=sale&limit=8`,
      { headers: { accept: "application/json", "x-api-key": key } }
    );
    if (!r.ok) return { salesReason: "events_http_" + r.status };
    const data = await r.json();
    const events = (data && data.asset_events) || [];
    const sales = events.map((e) => {
      // price: payment.quantity is in wei (string); decimals on payment
      let priceEth = null;
      const pay = e.payment;
      if (pay && pay.quantity != null) {
        const dec = pay.decimals != null ? pay.decimals : 18;
        priceEth = Number(pay.quantity) / Math.pow(10, dec);
      }
      const tokenId =
        (e.nft && e.nft.identifier) ||
        (e.asset && e.asset.identifier) ||
        null;
      const name = (e.nft && e.nft.name) || (e.asset && e.asset.name) || null;
      return {
        tokenId,
        name,
        priceEth: priceEth != null ? Number(priceEth.toFixed(4)) : null,
        symbol: (pay && pay.symbol) || "ETH",
        time: e.event_timestamp || e.closing_date || null,
      };
    });
    return { recentSales: sales };
  } catch (e) {
    return { salesReason: "events_error" };
  }
}

export default async function handler(req, res) {
  const key = process.env.OPENSEA_API_KEY;
  if (!key) return res.status(200).json({ ok: false, reason: "no_key" });

  const [stats, sales] = await Promise.all([getStats(key), getRecentSales(key)]);
  const out = { ok: true, contract: CONTRACT, ...stats, ...sales };
  // If both core calls failed, signal not-ok but still 200
  if (stats.reason && sales.salesReason) {
    return res.status(200).json({ ok: false, reason: stats.reason, salesReason: sales.salesReason });
  }
  return res.status(200).json(out);
}
