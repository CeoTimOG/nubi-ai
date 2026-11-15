// Which Rare Apepes Memetic Universe NFTs a player holds, read from OpenSea (OPENSEA_API_KEY, existing).
import { kv, kvJson } from "./core";

export const COLLECTIONS = [
  { key: "genesis", name: "Rare Apepes", short: "GEN", contract: "0x31d45de84fde2fb36575085e05754a4932dd5170" },
  { key: "zombie", name: "Zombie Apepes", short: "ZMB", contract: "0xf902a8baf88793ddf636a8791bd55a62b71c9ef4" },
  { key: "odyssey", name: "Apepe Odyssey", short: "ODY", contract: "0x1e50c58f9d26298a9c7c4f3050c43eb29ea4a0f0" },
  { key: "loot", name: "Apepe Loot", short: "LOOT", contract: "0x86440bb01856c2f537498f3de1413ca345d578f6" },
];
const OS = (process.env.OPENSEA_API_URL || "https://api.opensea.io") + "/api/v2";   // override only for local tests
const MAX_ITEMS = 300;

async function os(path) {
  const r = await fetch(OS + path, { headers: { accept: "application/json", "x-api-key": process.env.OPENSEA_API_KEY || "" } });
  if (!r.ok) { const e = new Error("opensea_" + r.status); e.status = r.status; throw e; }
  return r.json();
}
// OpenSea filters an account's NFTs by collection slug, so look the slug (and chain) up once per contract.
async function collectionMeta(c) {
  const key = "rak:os:" + c.contract;
  const hit = await kvJson(key).catch(() => null);
  if (hit && hit.slug) return hit;
  for (const chain of ["ethereum", "ape_chain"]) {
    try {
      const j = await os(`/chain/${chain}/contract/${c.contract}`);
      if (j && j.collection) {
        const meta = { chain, slug: j.collection };
        await kv("SET", key, JSON.stringify(meta), "EX", 30 * 86400).catch(() => {});
        return meta;
      }
    } catch (e) { if (e.status !== 404 && e.status !== 400) throw e; }
  }
  return null;
}
async function pool(tasks, n) {
  const out = []; let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, tasks.length) }, async () => { while (i < tasks.length) { const k = i++; out[k] = await tasks[k](); } }));
  return out;
}
const httpsOnly = (u) => (typeof u === "string" && /^https:\/\//.test(u) ? u : null);

export async function fetchHoldings(addresses) {
  if (!process.env.OPENSEA_API_KEY) return { ok: false, reason: "no_opensea_key", items: [], counts: {}, updated: Date.now() };
  const metas = await Promise.all(COLLECTIONS.map((c) => collectionMeta(c).catch(() => null)));
  const tasks = [];
  COLLECTIONS.forEach((c, ci) => {
    const m = metas[ci]; if (!m) return;
    addresses.forEach((a) => tasks.push(async () => {
      const got = [];
      let next = "", pages = 0;
      do {
        const j = await os(`/chain/${m.chain}/account/${a}/nfts?collection=${encodeURIComponent(m.slug)}&limit=200${next ? "&next=" + encodeURIComponent(next) : ""}`);
        (j.nfts || []).forEach((n) => {
          if (String(n.contract || "").toLowerCase() !== c.contract || n.is_nsfw) return;
          got.push({ c: c.key, id: String(n.identifier), name: n.name || `${c.name} #${n.identifier}`, img: httpsOnly(n.display_image_url || n.image_url) });
        });
        next = j.next || ""; pages++;
      } while (next && pages < 3);
      return got;
    }));
  });
  const res = await pool(tasks, 4);
  const items = [], seen = new Set(), counts = {};
  res.flat().forEach((it) => {
    const k = it.c + ":" + it.id; if (seen.has(k)) return; seen.add(k);
    counts[it.c] = (counts[it.c] || 0) + 1;
    if (items.length < MAX_ITEMS) items.push(it);
  });
  const order = COLLECTIONS.map((c) => c.key);
  items.sort((x, y) => order.indexOf(x.c) - order.indexOf(y.c) || (x.id.length - y.id.length) || (x.id < y.id ? -1 : 1));
  return { ok: true, items, counts, updated: Date.now() };
}
