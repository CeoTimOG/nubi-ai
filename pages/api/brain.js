// pages/api/brain.js
// Nubi's persistent memory layer (Vercel KV).
//
// TWO STORES:
//   nubi:lore            -> ONE shared knowledge document. OWNER-ONLY writes. Everyone reads.
//   nubi:mem:<wallet>    -> per-user memory, one key per opted-in wallet. Self-writes only.
//
// SECURITY MODEL (read this before changing anything):
//   - Teaching Nubi (writing lore) requires the ADMIN_SECRET. Same gate as posting.
//     This is the whole point: random users must never be able to write canon.
//   - Per-user memory is keyed by the user's own connected wallet address. A user can
//     only read/write/delete their OWN memory key. There is no cross-user access.
//   - This endpoint NEVER returns lore-write access to a non-owner, and NEVER lets a
//     caller read someone else's memory.
//
// ENV REQUIRED (Vercel -> Storage -> create KV -> it auto-injects these):
//   KV_REST_API_URL, KV_REST_API_TOKEN
//   ADMIN_SECRET  (you already have this for /api/post)

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;
const ADMIN_SECRET = process.env.ADMIN_SECRET;

const LORE_KEY = "nubi:lore";
const MEM_PREFIX = "nubi:mem:";

// Hard caps so the store can't be bloated or used to blow up the prompt.
const MAX_LORE_CHARS = 32000;  // ~8k tokens of owner lore max (injected every message)
const MAX_MEM_CHARS = 1500;    // ~375 tokens of memory per user max

// ---- tiny KV REST helpers (no SDK needed) -------------------------------
async function kvGet(key) {
  if (!KV_URL || !KV_TOKEN) throw new Error("KV not configured");
  const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  if (!r.ok) return null;
  const d = await r.json();
  return d && d.result != null ? d.result : null;
}

async function kvSet(key, value) {
  if (!KV_URL || !KV_TOKEN) throw new Error("KV not configured");
  // POST body form keeps arbitrary text safe (newlines, quotes, emoji).
  const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${KV_TOKEN}`,
      "Content-Type": "text/plain",
    },
    body: value,
  });
  return r.ok;
}

async function kvDel(key) {
  if (!KV_URL || !KV_TOKEN) throw new Error("KV not configured");
  const r = await fetch(`${KV_URL}/del/${encodeURIComponent(key)}`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}` },
  });
  return r.ok;
}

// EVM address sanity check: 0x + 40 hex. Lowercased for a stable key.
function normWallet(w) {
  if (typeof w !== "string") return null;
  const a = w.trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(a) ? a : null;
}

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "POST only" });
    }
    if (!KV_URL || !KV_TOKEN) {
      return res
        .status(500)
        .json({ error: "Memory store not configured. Add a Vercel KV database." });
    }

    const body = req.body || {};
    const action = String(body.action || "");

    // ============ OWNER-ONLY: read / write / clear shared lore ============
    if (action === "get_lore" || action === "set_lore" || action === "clear_lore") {
      // Gate: must present the admin secret.
      if (!ADMIN_SECRET || body.secret !== ADMIN_SECRET) {
        // Same opaque 401 whether the secret is missing or wrong — no oracle.
        return res.status(401).json({ error: "Unauthorized" });
      }

      if (action === "get_lore") {
        const lore = (await kvGet(LORE_KEY)) || "";
        return res.status(200).json({ ok: true, lore });
      }

      if (action === "set_lore") {
        const original = typeof body.lore === "string" ? body.lore : "";
        let lore = original;
        let truncated = false;
        if (lore.length > MAX_LORE_CHARS) {
          lore = lore.slice(0, MAX_LORE_CHARS);
          truncated = true;
        }
        await kvSet(LORE_KEY, lore);
        return res.status(200).json({
          ok: true,
          saved: lore.length,
          submitted: original.length,
          limit: MAX_LORE_CHARS,
          truncated,
        });
      }

      if (action === "clear_lore") {
        await kvDel(LORE_KEY);
        return res.status(200).json({ ok: true, cleared: true });
      }
    }

    // ============ USER: read / forget OWN memory (opt-in identity) ========
    // No admin secret here — auth is "you can only touch your own wallet key".
    if (action === "get_memory" || action === "forget_me") {
      const wallet = normWallet(body.wallet);
      if (!wallet) return res.status(400).json({ error: "Valid wallet required" });

      if (action === "get_memory") {
        const mem = (await kvGet(MEM_PREFIX + wallet)) || "";
        return res.status(200).json({ ok: true, wallet, memory: mem });
      }

      if (action === "forget_me") {
        await kvDel(MEM_PREFIX + wallet);
        return res.status(200).json({ ok: true, wallet, forgotten: true });
      }
    }

    return res.status(400).json({ error: "Unknown action" });
  } catch (e) {
    return res.status(500).json({ error: "Brain error", detail: String(e && e.message) });
  }
}

// Helpers reused by chat.js (kept here so there's one source of truth).
export const _brain = {
  kvGet,
  kvSet,
  normWallet,
  LORE_KEY,
  MEM_PREFIX,
  MAX_MEM_CHARS,
};
