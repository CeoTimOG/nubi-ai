// pages/brain.js
// Owner-only console for teaching Nubi. Visit: nubi.rareapepes.com/brain
//
// Flow: enter ADMIN_SECRET -> it loads current lore -> edit -> save.
// The secret is held only in React state (never stored), and sent per-request
// to /api/brain, which is the actual gate. This page is just the cockpit.
//
// SAFETY: never paste anything private here (e.g. personal/employment notes).
// Whatever you save becomes part of what Nubi can tell ANY user.

import { useState } from "react";

const PURPLE = "#c084fc";
const BG = "#0a0510";

export default function Brain() {
  const [secret, setSecret] = useState("");
  const [unlocked, setUnlocked] = useState(false);
  const [lore, setLore] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  const call = async (action, extra = {}) => {
    const r = await fetch("/api/brain", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action, secret, ...extra }),
    });
    return { ok: r.ok, data: await r.json().catch(() => ({})) };
  };

  const unlock = async () => {
    if (!secret) return;
    setBusy(true);
    setStatus("Authenticating…");
    const { ok, data } = await call("get_lore");
    setBusy(false);
    if (ok && data.ok) {
      setLore(data.lore || "");
      setUnlocked(true);
      setStatus(data.lore ? "Field intel loaded." : "No intel yet. Teach Nubi something.");
    } else {
      setStatus("✕ Access denied. Wrong passphrase.");
    }
  };

  const save = async () => {
    setBusy(true);
    setStatus("Uploading to Nubi…");
    const { ok, data } = await call("set_lore", { lore });
    setBusy(false);
    if (ok && data.ok) {
      if (data.truncated) {
        setStatus(
          `⚠ TOO LONG — saved only ${data.saved} of ${data.submitted} chars (limit ${data.limit}). ` +
          `Everything past ${data.limit} was CUT. Trim your text so nothing important is lost.`
        );
      } else {
        setStatus(`✓ Saved (${data.saved} chars). Nubi knows this now.`);
      }
    } else {
      setStatus("✕ Save failed.");
    }
  };

  const clearAll = async () => {
    if (!confirm("Wipe ALL of Nubi's taught intel? This can't be undone.")) return;
    setBusy(true);
    const { ok } = await call("clear_lore");
    setBusy(false);
    if (ok) {
      setLore("");
      setStatus("✓ Intel wiped. Nubi is back to base lore only.");
    }
  };

  const box = {
    background: "rgba(192,132,252,0.05)",
    border: "1px solid rgba(192,132,252,0.25)",
    color: "#e9d5ff",
    fontFamily: "'Share Tech Mono', monospace",
    fontSize: 14,
    padding: "11px 13px",
    borderRadius: 4,
    outline: "none",
    width: "100%",
  };
  const btn = (solid) => ({
    background: solid ? PURPLE : "transparent",
    color: solid ? "#1a0a2e" : PURPLE,
    border: `1px solid ${PURPLE}`,
    fontFamily: "'Orbitron', sans-serif",
    fontWeight: 700,
    fontSize: 12,
    letterSpacing: 1,
    padding: "10px 18px",
    borderRadius: 4,
    cursor: busy ? "wait" : "pointer",
    opacity: busy ? 0.6 : 1,
  });

  return (
    <div
      style={{
        minHeight: "100vh",
        background: BG,
        color: "#e9d5ff",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: 20,
      }}
    >
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Orbitron:wght@400;700;900&family=Share+Tech+Mono&display=swap');
        *{box-sizing:border-box} body{margin:0;background:${BG}}
        textarea::placeholder,input::placeholder{color:rgba(192,132,252,0.3)}`}</style>

      <div style={{ width: "100%", maxWidth: 720 }}>
        <div
          style={{
            fontFamily: "'Orbitron',sans-serif",
            fontWeight: 900,
            fontSize: 22,
            letterSpacing: 3,
            color: PURPLE,
            marginBottom: 4,
          }}
        >
          ⚡ NUBI · BRAIN CONSOLE
        </div>
        <div style={{ fontSize: 12, color: "rgba(233,213,255,0.55)", marginBottom: 22, fontFamily: "'Share Tech Mono',monospace" }}>
          Owner-only. What you save here, Nubi can tell anyone. Never paste anything private.
        </div>

        {!unlocked ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              type="password"
              value={secret}
              onChange={(e) => setSecret(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && unlock()}
              placeholder="Owner passphrase"
              style={{ ...box, flex: 1, minWidth: 240 }}
            />
            <button onClick={unlock} disabled={busy} style={btn(true)}>
              UNLOCK
            </button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11, color: PURPLE, letterSpacing: 2, marginBottom: 7, fontFamily: "'Orbitron',sans-serif" }}>
              NUBI'S FIELD INTEL — roadmap, RareHouse, announcements, anything live data can't cover
            </div>
            <textarea
              value={lore}
              onChange={(e) => setLore(e.target.value)}
              rows={16}
              placeholder={
                "Example:\n• RareHouse marketplace launches Q3 2026 on KUBChain.\n• Apepe Odyssey Chapter 2 in production.\n• Next community call: first Friday each month, 3pm ET in Discord.\n\nWrite it as facts. Nubi will weave them into his own voice."
              }
              style={{ ...box, resize: "vertical", lineHeight: 1.5 }}
            />
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: 6 }}>
              <div style={{ fontSize: 12, color: lore.length > 32000 ? "#ff6b9d" : "rgba(192,132,252,0.6)", fontFamily: "'Share Tech Mono',monospace" }}>
                {lore.length.toLocaleString()} / 32,000 characters{lore.length > 32000 ? "  — OVER LIMIT, excess will be cut" : ""}
              </div>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 12, flexWrap: "wrap" }}>
              <button onClick={save} disabled={busy} style={btn(true)}>
                SAVE TO NUBI
              </button>
              <button onClick={clearAll} disabled={busy} style={btn(false)}>
                WIPE ALL INTEL
              </button>
              <button onClick={() => { setUnlocked(false); setSecret(""); setStatus(""); }} style={btn(false)}>
                LOCK
              </button>
            </div>
          </>
        )}

        {status && (
          <div style={{ marginTop: 16, fontSize: 13, color: (status.startsWith("✕") || status.startsWith("⚠")) ? "#ff6b9d" : "rgba(233,213,255,0.8)", fontFamily: "'Share Tech Mono',monospace" }}>
            {status}
          </div>
        )}
      </div>
    </div>
  );
}
