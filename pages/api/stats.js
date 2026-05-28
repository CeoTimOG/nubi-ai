// pages/api/stats.js — live read-only collection stats. Always returns 200; never breaks the app.
export default async function handler(req, res) {
  const contract = "0x31d45de84fde2fb36575085e05754a4932dd5170";
  try {
    const key = process.env.RESERVOIR_API_KEY;
    if (!key) return res.status(200).json({ ok: false, reason: "no_key" });
    const r = await fetch(
      `https://api.reservoir.tools/collections/v7?id=${contract}`,
      { headers: { accept: "*/*", "x-api-key": key } }
    );
    const data = await r.json();
    const c = data && data.collections && data.collections[0];
    if (!c) return res.status(200).json({ ok: false, reason: "no_data" });
    return res.status(200).json({
      ok: true,
      floorEth: c.floorAsk?.price?.amount?.native ?? null,
      ownerCount: c.ownerCount ?? null,
      tokenCount: c.tokenCount ?? null,
      onSaleCount: c.onSaleCount ?? null,
      volumeAll: c.volume?.allTime ?? null,
      volume7d: c.volume?.["7day"] ?? null,
    });
  } catch (e) {
    return res.status(200).json({ ok: false, reason: "error" });
  }
}
