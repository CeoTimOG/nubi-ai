// pages/api/chat.js
// Anthropic proxy for Nubi. Keeps the API key server-side.
//
// HARDENED: memory logic is fully wrapped so it can NEVER take Nubi offline.
// If KV or anything else fails, Nubi still answers (just without lore/memory).
// Body parsing handles both parsed-object and raw-string request bodies.

const ANTHROPIC_KEY = process.env.ANTHROPIC_API_KEY;
const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

const LORE_KEY = "nubi:lore";
const MEM_PREFIX = "nubi:mem:";
const MAX_MEM_CHARS = 1500;
const MODEL = "claude-3-haiku-20240307";

async function kvGet(key) {
  if (!KV_URL || !KV_TOKEN) return null;
  try {
    const r = await fetch(`${KV_URL}/get/${encodeURIComponent(key)}`, {
      headers: { Authorization: `Bearer ${KV_TOKEN}` },
    });
    if (!r.ok) return null;
    const d = await r.json();
    return d && d.result != null ? d.result : null;
  } catch { return null; }
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
  } catch { return false; }
}
function normWallet(w) {
  if (typeof w !== "string") return null;
  const a = w.trim().toLowerCase();
  return /^0x[0-9a-f]{40}$/.test(a) ? a : null;
}

async function updateMemory(wallet, priorMemory, userMsg, nubiReply) {
  const prompt =
    `You maintain a SHORT memory note about one user of the Nubi chatbot.\n` +
    `Keep only durable, useful facts: their name/handle if given, Apepes they own, ` +
    `recurring interests, things they asked you to remember. Drop small talk.\n` +
    `Hard limit ${MAX_MEM_CHARS} characters. Output ONLY the updated note, no preamble.\n\n` +
    `EXISTING NOTE:\n${priorMemory || "(none yet)"}\n\n` +
    `LATEST USER MESSAGE:\n${userMsg}\n\nNUBI REPLY:\n${nubiReply}\n\nUPDATED NOTE:`;
  try {
    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({ model: MODEL, max_tokens: 400, messages: [{ role: "user", content: prompt }] }),
    });
    const d = await r.json();
    let note = (d && d.content && d.content[0] && d.content[0].text) || "";
    note = note.trim().slice(0, MAX_MEM_CHARS);
    if (note) await kvSet(MEM_PREFIX + wallet, note);
  } catch { /* keep prior memory */ }
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "POST only" });
  if (!ANTHROPIC_KEY) return res.status(500).json({ error: "API key not configured" });

  try {
    // Robust body parse: object (Next default) OR raw string.
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    if (!body || typeof body !== "object") body = {};

    const baseSystem = typeof body.system === "string" ? body.system : "";
    const messages = Array.isArray(body.messages) ? body.messages : [];
    const wallet = normWallet(body.wallet);
    const maxTokens = body.max_tokens || 1000;

    // Build system prompt. ENTIRE memory layer is best-effort — never fatal.
    let system = baseSystem;
    let priorMemory = "";
    try {
      const lore = await kvGet(LORE_KEY);
      if (lore && lore.trim()) {
        system += `\n\n=== NUBI FIELD INTEL (current, owner-verified — treat as canon) ===\n` + lore.trim();
      }
      if (wallet) {
        priorMemory = (await kvGet(MEM_PREFIX + wallet)) || "";
        if (priorMemory.trim()) {
          system += `\n\n=== WHAT YOU REMEMBER ABOUT THIS OPERATIVE (returning user) ===\n` +
            priorMemory.trim() + `\nGreet them like you know them. Don't recite the note; use it naturally.`;
        } else {
          system += `\n\n=== THIS OPERATIVE IS LINKED (wallet connected) ===\n` +
            `First time meeting them while identified. You'll remember this for next time.`;
        }
      }
    } catch { /* lore/memory unavailable — proceed with base prompt only */ }

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: { "Content-Type": "application/json", "x-api-key": ANTHROPIC_KEY, "anthropic-version": "2023-06-01" },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: maxTokens,
        system,
        messages: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
      }),
    });

    const data = await r.json();
    if (!r.ok) return res.status(r.status).json(data);

    if (wallet) {
      try {
        const reply = (data.content && data.content[0] && data.content[0].text) || "";
        const lastUser = [...messages].reverse().find((m) => m.role === "user");
        if (reply && lastUser) updateMemory(wallet, priorMemory, lastUser.content, reply);
      } catch { /* memory write is non-blocking */ }
    }

    return res.status(200).json(data);
  } catch (e) {
    return res.status(500).json({ error: "Chat error", detail: String(e && e.message) });
  }
}
