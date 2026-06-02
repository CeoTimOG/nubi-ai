// pages/api/debug-brain.js — TEMPORARY diagnostic. DELETE after we fix this.
// Visit /api/debug-brain in your browser. Shows exactly what chat.js sees.

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

export default async function handler(req, res) {
  const report = {
    env_KV_URL_present: !!KV_URL,
    env_KV_TOKEN_present: !!KV_TOKEN,
    kv_url_prefix: KV_URL ? KV_URL.slice(0, 30) + "..." : null,
    lore_read: null,
    lore_length: 0,
    raw_response_status: null,
    error: null,
  };
  try {
    if (!KV_URL || !KV_TOKEN) {
      report.error = "KV env vars NOT visible to this function";
      return res.status(200).json(report);
    }
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent("nubi:lore")}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    report.raw_response_status = r.status;
    const d = await r.json();
    report.lore_read = d && d.result != null ? d.result : "(null — key empty or missing)";
    report.lore_length = report.lore_read && report.lore_read !== "(null — key empty or missing)" ? report.lore_read.length : 0;
  } catch (e) {
    report.error = String(e && e.message);
  }
  return res.status(200).json(report);
}
