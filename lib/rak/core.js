// Shared plumbing for the RAK 3022 game API (pages/api/rak/*): Upstash KV, CORS, rate limits and the signed
// game token the game sends back as "Authorization: Bearer <token>" after a Glyph sign-in.
import crypto from "crypto";
import { isGameOrigin } from "./origins";

const KV_URL = process.env.KV_REST_API_URL;
const KV_TOKEN = process.env.KV_REST_API_TOKEN;

// ---- KV (Upstash REST: a command is a JSON array) -------------------------------------------------
export async function kv(...cmd) {
  if (!KV_URL || !KV_TOKEN) throw new Error("kv_not_configured");
  const r = await fetch(KV_URL, {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmd.map(String)),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok || j.error) throw new Error("kv: " + (j.error || r.status));
  return j.result;
}
// Several commands in one round trip. Returns one result per command (null where that command failed).
export async function kvPipe(cmds) {
  if (!cmds.length) return [];
  if (!KV_URL || !KV_TOKEN) throw new Error("kv_not_configured");
  const r = await fetch(KV_URL.replace(/\/$/, "") + "/pipeline", {
    method: "POST",
    headers: { Authorization: `Bearer ${KV_TOKEN}`, "Content-Type": "application/json" },
    body: JSON.stringify(cmds.map((c) => c.map(String))),
  });
  const j = await r.json().catch(() => null);
  if (!r.ok || !Array.isArray(j)) throw new Error("kv_pipeline: " + r.status);
  return j.map((x) => (x && !x.error ? x.result : null));
}
export async function kvJson(key) {
  const v = await kv("GET", key);
  if (!v) return null;
  try { return JSON.parse(v); } catch (e) { return null; }
}

// ---- HTTP -------------------------------------------------------------------------------------------
const EXTRA = (process.env.RAK_ORIGINS || "").split(",").map((s) => s.trim()).filter(Boolean);
export function allowedOrigin(origin, host) {
  if (!origin) return false;
  if (EXTRA.includes(origin) || isGameOrigin(origin)) return true;
  try { return !!host && new URL(origin).host === host; } catch (e) { return false; }   // same site (incl. Vercel previews)
}
// Sets CORS headers. Returns true when the request has been answered (pre-flight or a refused origin).
export function cors(req, res, methods) {
  const o = req.headers.origin;
  res.setHeader("Vary", "Origin");
  if (o && allowedOrigin(o, req.headers.host)) {
    res.setHeader("Access-Control-Allow-Origin", o);
    res.setHeader("Access-Control-Allow-Headers", "Content-Type, Authorization");
    res.setHeader("Access-Control-Allow-Methods", methods + ", OPTIONS");
    res.setHeader("Access-Control-Max-Age", "600");
  } else if (o) {
    res.status(403).json({ ok: false, error: "origin_not_allowed" });
    return true;
  }
  if (req.method === "OPTIONS") { res.status(204).end(); return true; }
  return false;
}
export function body(req) {
  const b = req.body;
  if (b && typeof b === "object") return b;
  try { return JSON.parse(b || "{}"); } catch (e) { return {}; }
}
export function clientIp(req) {
  const f = String(req.headers["x-forwarded-for"] || "").split(",")[0].trim();
  return f || (req.socket && req.socket.remoteAddress) || "0";
}
export const sha = (s) => crypto.createHash("sha256").update(String(s)).digest("hex");

// Fixed-window limit. Fails open if KV is down (the game must keep working).
export async function limit(key, max, windowSec) {
  const k = "rak:rl:" + key;
  try {
    const [, n] = await kvPipe([["SET", k, 0, "EX", windowSec, "NX"], ["INCR", k]]);
    return !(n > max);
  } catch (e) { return true; }
}

// ---- game token ------------------------------------------------------------------------------------
// HMAC-signed, so no session store is needed. Secret: RAK_GAME_SECRET, or derived from PRIVY_APP_SECRET.
function secret() {
  if (process.env.RAK_GAME_SECRET) return process.env.RAK_GAME_SECRET;
  if (process.env.PRIVY_APP_SECRET) return sha("rak-game-token:" + process.env.PRIVY_APP_SECRET);
  return null;
}
const mac = (s, data) => crypto.createHmac("sha256", s).update(data).digest("base64url");
export function signToken(payload, ttlSec) {
  const s = secret(); if (!s) throw new Error("token_secret_missing");
  const data = Buffer.from(JSON.stringify({ ...payload, exp: Math.floor(Date.now() / 1000) + ttlSec })).toString("base64url");
  return data + "." + mac(s, data);
}
export function readToken(req) {
  const s = secret(); if (!s) return null;
  const h = String(req.headers.authorization || "");
  const t = h.startsWith("Bearer ") ? h.slice(7).trim() : "";
  const [data, sig] = t.split(".");
  if (!data || !sig) return null;
  const want = Buffer.from(mac(s, data)), got = Buffer.from(sig);
  if (want.length !== got.length || !crypto.timingSafeEqual(want, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(data, "base64url").toString("utf8"));
    return p && p.pid && p.exp * 1000 > Date.now() ? p : null;
  } catch (e) { return null; }
}
export const playerId = (did) => "p" + sha("rak-player:" + did).slice(0, 16);
