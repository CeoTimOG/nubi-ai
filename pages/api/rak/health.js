// GET /api/rak/health -> which parts of the game API are configured and working. Reveals no secrets.
// Open https://nubi.rareapepes.com/api/rak/health after any settings change.
import { cors, kv } from "../../../lib/rak/core";
import { privyCheck, jwksCount } from "../../../lib/rak/privy";

export default async function handler(req, res) {
  if (cors(req, res, "GET")) return;
  res.setHeader("Cache-Control", "no-store");
  const [db, privy, keys] = await Promise.all([
    kv("PING").then((r) => (r === "PONG" ? "ok" : String(r))).catch((e) => "error: " + e.message),
    privyCheck(),
    jwksCount(),
  ]);
  const checks = {
    database: db,
    privySecret: privy,
    privySigningKeys: keys > 0 ? "ok (" + keys + ")" : "unavailable",
    tokenSecret: process.env.RAK_GAME_SECRET || process.env.PRIVY_APP_SECRET ? "ok" : "missing",
    opensea: process.env.OPENSEA_API_KEY ? "ok" : "missing",
    nubiChat: process.env.ANTHROPIC_API_KEY ? "ok" : "missing",
  };
  const ok = Object.values(checks).every((v) => String(v).startsWith("ok"));
  return res.status(200).json({ ok, checks });
}
