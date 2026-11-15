// GET /api/rak/leaderboard?board=score|speed|kills|coins|bosses|apepes|lvl1..lvl6&period=all|week&limit=25
// With a game token it also returns the caller's own rank on that board.
import { cors, readToken, kvPipe } from "../../../lib/rak/core";
import { BOARDS, boardKey, PUB } from "../../../lib/rak/players";

export default async function handler(req, res) {
  if (cors(req, res, "GET")) return;
  if (req.method !== "GET") return res.status(405).json({ ok: false, error: "get_only" });
  const board = BOARDS[req.query.board] ? String(req.query.board) : "score";
  const B = BOARDS[board];
  const period = req.query.period === "week" && B.weekly ? "week" : "all";
  const n = Math.max(1, Math.min(50, parseInt(req.query.limit, 10) || 25));
  const key = boardKey(board, period), t = readToken(req);
  try {
    const range = B.asc ? ["ZRANGE", key, 0, n - 1, "WITHSCORES"] : ["ZRANGE", key, 0, n - 1, "REV", "WITHSCORES"];
    const cmds = [range, ["ZCARD", key]];
    if (t) cmds.push([B.asc ? "ZRANK" : "ZREVRANK", key, t.pid], ["ZSCORE", key, t.pid]);
    const [flat, total, myRank, myVal] = await kvPipe(cmds);
    const ids = [], vals = [];
    for (let i = 0; flat && i < flat.length; i += 2) { ids.push(flat[i]); vals.push(Number(flat[i + 1])); }
    const cards = ids.length ? (await kvPipe([["HMGET", PUB, ...ids]]))[0] || [] : [];
    const rows = ids.map((pid, i) => {
      let c = {}; try { c = JSON.parse(cards[i] || "{}"); } catch (e) {}
      return { rank: i + 1, pid, name: c.n || "Unknown", img: c.i || null, nft: c.a || null, badges: c.b || {}, value: vals[i] };
    });
    res.setHeader("Cache-Control", t ? "no-store" : "public, s-maxage=15, stale-while-revalidate=45");
    return res.status(200).json({
      ok: true, board, period, label: B.label, time: !!B.time, total: total || 0, rows,
      me: t ? { pid: t.pid, rank: myRank == null ? null : myRank + 1, value: myVal == null ? null : Number(myVal) } : null,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: "board_failed", detail: String(e && e.message) });
  }
}
