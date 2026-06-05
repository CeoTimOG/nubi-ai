// pages/api/chat.js
// Anthropic proxy for Nubi. Keeps the API key server-side.
//
// WHAT CHANGED vs the old chat.js:
//   1. Pulls Nubi's shared lore (owner-taught) from KV and appends it to system.
//   2. If the frontend sends a `wallet` (user opted into being remembered), pulls
//      that wallet's memory and appends it too — and after the reply, updates it.
//   3. If no wallet is sent, behaves EXACTLY like before: stateless, open to anyone.
//   4. [FIX] Memory write is now AWAITED before responding. On Vercel, un-awaited
//      background work is killed once the response is sent, so the note never saved.
//   5. [NEW] GET /api/chat returns a KV health check so you can verify storage.
//
// The frontend still sends `system` (NUBI_SYSTEM + liveData). We append to it.
//
// ENV: ANTHROPIC_API_KEY (existing). KV_REST_API_URL / KV_REST_API_TOKEN (for memory).

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const LORE_KEY = "nubi:lore";
const MEM_PREFIX = "nubi:mem:";
const MAX_MEM_CHARS = 1500;
const MODEL = "claude-haiku-4-5-20251001";

// ---- KV helpers (same contract as brain.js) -----------------------------
async function kvGet(key) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.result != null ? d.result : null;
  } catch {
    return null;
  }
}
async function kvSet(key, value) {
  if (!KV_URL || !KV_TOKEN) return false;
  try {
    const r = await fetch(`${KV_URL}/set/${encodeURIComponent(key)}`, {
      method: "POST",
      headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "text/plain" },
      body: value,
    });
    return r.ok;
  } catch {
    return false;
  }
}
function normWallet(w) {
  if (typeof w !== "string") return null;
  const a = w.trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(a) ? a : null;
}

// Distill a compact memory note from the latest exchange. Best-effort: if it
// fails, we just keep the previous memory. Never blocks the user's reply.
async function updateMemory(wallet, priorMemory, userMsg, nubiReply) {
  const prompt =
    `You maintain a SHORT memory note about one user of the Nubi chatbot.\n` +
    `Keep only durable, useful facts: their name/handle if given, Apepes they own, ` +
    `recurring interests, things they asked you to remember. Drop small talk.\n` +
    `Hard limit ${MAX_MEM_CHARS} characters. Output ONLY the updated note, no preamble.\n\n` +
    `EXISTING NOTE:\n${priorMemory || "(none yet)"}\n\n` +
    `LATEST USER MESSAGE:\n${userMsg}\n\n` +
    `NUBI REPLY:\n${nubiReply}\n\n` +
    `UPDATED NOTE:`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 400,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    const d = await r.json();
    let note = (d && d.content && d.content[0] && d.content[0].text) || "";
    note = note.trim().slice(0, MAX_MEM_CHARS);
    if (note) await kvSet(MEM_PREFIX + wallet, note);
  } catch {
    /* keep prior memory on failure */
  }
}

export default async function handler(req, res) {
  // --- KV health check: visit /api/chat in a browser to verify memory storage ---
  if (req.method === "GET") {
    const probeKey = "nubi:diag:probe";
    const stamp = "ok-" + Date.now();
    const wrote = await kvSet(probeKey, stamp);
    const readBack = await kvGet(probeKey);
    return res.status(200).json({
      kvConfigured: Boolean(KV_URL && KV_TOKEN),
      wrote,
      readBack,
      roundTrip:
        readBack === stamp
          ? "KV OK — reads and writes are working"
          : "KV FAILED — check KV_REST_API_URL / KV_REST_API_TOKEN",
    });
  }

  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: "API key not configured" });

  try {
    const body = req.body || {};
    const baseSystem = typeof body.system === "string" ? body.system : "";
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const wallet = normWallet(body.wallet); // null if not provided / invalid
    const maxTokens = body.max_tokens || 1000;

    // --- assemble the system prompt: base + shared lore + this user's memory ---
    let system = baseSystem;

    const lore = await kvGet(LORE_KEY);
    if (lore && lore.trim()) {
      system +=
        `\n\n=== NUBI FIELD INTEL (current, owner-verified — treat as canon) ===\n` +
        lore.trim();
    }

    let priorMemory = "";
    if (wallet) {
      priorMemory = (await kvGet(MEM_PREFIX + wallet)) || "";
      if (priorMemory.trim()) {
        system +=
          `\n\n=== WHAT YOU REMEMBER ABOUT THIS OPERATIVE (returning user) ===\n` +
          priorMemory.trim() +
          `\nGreet them like you know them. Don't recite the note; use it naturally.`;
      } else {
        system +=
          `\n\n=== THIS OPERATIVE IS LINKED (wallet connected) ===\n` +
          `First time you're meeting them while they're identified. ` +
          `You'll remember this conversation for next time.`;
      }
    }

    // --- main call (unchanged behavior: last 10 turns) ---
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ANTHROPIC_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);

    // --- memory update (only if identified) ---
    // FIX: must AWAIT. On Vercel the function is frozen once the response is sent,
    // so an un-awaited update never finishes and nothing is ever saved.
    if (wallet) {
      const reply = (data.content && data.content[0] && data.content[0].text) || "";
      const lastUser = [...messages].reverse().find((m) => m.role === "user");
      if (reply && lastUser) {
        await updateMemory(wallet, priorMemory, lastUser.content, reply);
      }
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Chat error", detail: String(e && e.message) });
  }
}
