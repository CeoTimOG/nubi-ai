// Server side of the Glyph sign-in. Glyph runs on Privy, so the /rak page hands us the player's Privy access
// token: we check its signature (ES256) and then ask Privy which wallets belong to that player.
// ENV: NEXT_PUBLIC_PRIVY_APP_ID (existing), PRIVY_APP_SECRET (Privy dashboard > App settings > API keys).
// Optional: PRIVY_VERIFICATION_KEY (the PEM from the dashboard) skips one request on a cold start.
import crypto from "crypto";

// Pasted values often carry a stray space, line break or quotes; any of those makes Privy reject the secret.
const clean = (v) => String(v || "").trim().replace(/^["']+|["']+$/g, "").trim();
const APP_ID = clean(process.env.NEXT_PUBLIC_PRIVY_APP_ID || process.env.PRIVY_APP_ID);
const SECRET = clean(process.env.PRIVY_APP_SECRET);
const API = (process.env.PRIVY_API_URL || "https://auth.privy.io") + "/api/v1";   // override only for local tests
let keyCache = null;

export const privyConfigured = () => !!(APP_ID && SECRET);
function headers() {
  return {
    Authorization: "Basic " + Buffer.from(APP_ID + ":" + SECRET).toString("base64"),
    "privy-app-id": APP_ID,
    "Content-Type": "application/json",
  };
}
// Accepts the key however it was pasted: a full PEM, one line with spaces, "\\n" escapes, quotes, or just the base64.
function toKey(raw) {
  const body = String(raw || "").replace(/\\n/g, "\n").replace(/-----(BEGIN|END) PUBLIC KEY-----/g, "").replace(/[^A-Za-z0-9+/=]/g, "");
  if (!body) throw new Error("no_verification_key");
  return crypto.createPublicKey({ key: Buffer.from(body, "base64"), format: "der", type: "spki" });
}
async function verificationKey() {
  if (keyCache) return keyCache;
  if (process.env.PRIVY_VERIFICATION_KEY) {
    try { return (keyCache = toKey(process.env.PRIVY_VERIFICATION_KEY)); } catch (e) { /* unusable: ask Privy instead */ }
  }
  const r = await fetch(`${API}/apps/${APP_ID}`, { headers: headers() });
  if (!r.ok) throw new Error("privy_app_" + r.status + (r.status === 401 ? " (check PRIVY_APP_SECRET)" : ""));
  return (keyCache = toKey((await r.json()).verification_key));
}
const part = (s) => JSON.parse(Buffer.from(s, "base64url").toString("utf8"));

// Privy's public signing keys (JWKS), matched by the token's "kid". Public, so no secret is needed; refreshed hourly,
// or at most once a minute when a token names a key we haven't seen (key rotation). Falls back to the app's key.
let jwks = null, jwksAt = 0, jwksTry = 0;
async function keysFor(kid) {
  const stale = !jwks || Date.now() - jwksAt > 3600e3 || (kid && !jwks[kid]);
  if (stale && Date.now() - jwksTry > 60e3) {
    jwksTry = Date.now();
    try {
      const r = await fetch(`${API}/apps/${APP_ID}/jwks.json`);
      const j = r.ok ? await r.json() : null, m = {};
      ((j && j.keys) || []).forEach((k) => { try { m[k.kid || "_" + Object.keys(m).length] = crypto.createPublicKey({ key: k, format: "jwk" }); } catch (e) {} });
      if (Object.keys(m).length) { jwks = m; jwksAt = Date.now(); }
    } catch (e) { /* use what we have */ }
  }
  if (jwks) return kid && jwks[kid] ? [jwks[kid]] : Object.values(jwks);
  return [await verificationKey()];
}

// Returns the player's Privy DID, or throws.
export async function verifyAccessToken(jwt) {
  const p = String(jwt || "").split(".");
  if (p.length !== 3) throw new Error("bad_token");
  const h = part(p[0]);
  if (h.alg !== "ES256") throw new Error("bad_alg");
  const data = Buffer.from(p[0] + "." + p[1]), sig = Buffer.from(p[2], "base64url");
  const ok = (await keysFor(h.kid)).some((key) => crypto.verify("sha256", data, { key, dsaEncoding: "ieee-p1363" }, sig));
  if (!ok) throw new Error("bad_signature");
  const c = part(p[1]);
  const aud = Array.isArray(c.aud) ? c.aud : [c.aud];
  if (c.iss !== "privy.io" || !aud.includes(APP_ID)) throw new Error("wrong_app");
  if (!(c.exp * 1000 > Date.now())) throw new Error("expired");
  if (!/^did:privy:[A-Za-z0-9]+$/.test(c.sub || "")) throw new Error("bad_subject");
  return c.sub;
}

// For /api/rak/health: does Privy accept our app secret? (An unknown user id gives 404 when it does, 401 when not.)
export async function privyCheck() {
  if (!APP_ID) return "app_id_missing";
  if (!SECRET) return "secret_missing";
  try {
    const r = await fetch(`${API}/users/${encodeURIComponent("did:privy:healthcheck0000000000000000")}`, { headers: headers() });
    return r.status === 404 || r.ok ? "ok" : r.status === 401 || r.status === 403 ? "secret_rejected_" + r.status : "privy_" + r.status;
  } catch (e) { return "unreachable"; }
}
export async function jwksCount() { try { return (await keysFor(null)).length; } catch (e) { return 0; } }

// Every EVM address on the account: the Glyph wallets (cross-app) and any wallet linked with Privy.
export async function privyWallets(did) {
  const r = await fetch(`${API}/users/${encodeURIComponent(did)}`, { headers: headers() });
  if (!r.ok) throw new Error("privy_user_" + r.status);
  const u = await r.json();
  const out = [], seen = new Set();
  const add = (a, kind) => {
    a = String(a || "").toLowerCase();
    if (/^0x[0-9a-f]{40}$/.test(a) && !seen.has(a)) { seen.add(a); out.push({ address: a, kind }); }
  };
  for (const la of u.linked_accounts || []) {
    if (la.type === "cross_app") {
      (la.smart_wallets || []).forEach((w) => add(w.address, "glyph"));
      (la.embedded_wallets || []).forEach((w) => add(w.address, "glyph"));
    } else if (la.type === "wallet" && (!la.chain_type || la.chain_type === "ethereum")) {
      add(la.address, la.wallet_client_type === "privy" ? "embedded" : "linked");
    } else if (la.type === "smart_wallet") add(la.address, "smart");
  }
  return out.slice(0, 8);
}
