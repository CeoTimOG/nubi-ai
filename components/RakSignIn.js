// Browser-only part of /rak. Glyph login -> Privy access token -> /api/rak/session -> game token -> back to the game.
import { useEffect, useRef, useState, Component } from "react";
import { GlyphPrivyProvider, useGlyph } from "@use-glyph/sdk-react";
import { usePrivy, useLinkAccount } from "@privy-io/react-auth";
import { isGameOrigin } from "../lib/rak/origins";

const PRIVY_APP_ID = process.env.NEXT_PUBLIC_PRIVY_APP_ID || "";
const FALLBACK_RETURN = "https://mobile.rareapepes.com/";

// Where to send the player back to. Only the game's own sites are accepted.
function readReturn() {
  try {
    const q = new URLSearchParams(window.location.search);
    const u = new URL(q.get("return") || FALLBACK_RETURN);
    if (!isGameOrigin(u.origin)) return { url: FALLBACK_RETURN, origin: new URL(FALLBACK_RETURN).origin };
    u.hash = "";
    return { url: u.toString(), origin: u.origin };
  } catch (e) { return { url: FALLBACK_RETURN, origin: new URL(FALLBACK_RETURN).origin }; }
}
const short = (a) => a.slice(0, 6) + "…" + a.slice(-4);

class Boundary extends Component {
  constructor(p) { super(p); this.state = { err: null }; }
  static getDerivedStateFromError(err) { return { err }; }
  render() { return this.state.err ? this.props.fallback : this.props.children; }
}

function Flow({ ret }) {
  const { authenticated, login, ready } = useGlyph();
  const { getAccessToken } = usePrivy();
  const [st, setSt] = useState({ phase: "start", msg: "" });
  const [prof, setProf] = useState(null);
  const busy = useRef(false);
  const popup = typeof window !== "undefined" && !!window.opener && !window.opener.closed;

  function deliver(token, profile) {
    if (popup) {
      try { window.opener.postMessage({ type: "rak:auth", token, profile }, ret.origin); } catch (e) {}
    } else {
      window.location.replace(ret.url + "#rak_token=" + encodeURIComponent(token));
    }
  }
  async function issue(afterLink) {
    if (busy.current) return; busy.current = true;
    setSt({ phase: "working", msg: afterLink ? "Reading your new wallet…" : "Checking your wallets…" });
    try {
      const at = await getAccessToken();
      if (!at) throw new Error("No sign-in token from Glyph. Try again.");
      const r = await fetch("/api/rak/session", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ privyToken: at }) });
      const j = await r.json().catch(() => ({}));
      if (!j.ok) throw new Error(j.error === "login_not_configured" ? "Sign-in isn't switched on yet." : "Sign-in failed (" + (j.error || r.status) + (j.detail ? ": " + j.detail : "") + ").");
      setProf(j.profile);
      const holds = Object.values(j.profile.badges || {}).some((n) => n > 0);
      if (popup) deliver(j.token, j.profile);
      if (holds && !afterLink) {
        setSt({ phase: "done", msg: "", token: j.token });
        setTimeout(() => (popup ? window.close() : deliver(j.token, j.profile)), 1200);
      } else {
        setSt({ phase: "done", msg: "", token: j.token });
      }
    } catch (e) {
      setSt({ phase: "error", msg: e.message || "Something went wrong." });
    } finally { busy.current = false; }
  }
  const { linkWallet } = useLinkAccount({ onSuccess: () => issue(true), onError: () => {} });
  useEffect(() => { if (ready && authenticated && st.phase === "start") issue(false); }, [ready, authenticated]); // eslint-disable-line

  const back = () => (popup ? window.close() : st.token && deliver(st.token, prof));
  const holds = prof && Object.values(prof.badges || {}).some((n) => n > 0);

  return (
    <div className="card">
      <img className="nubi" src="/icons/android-chrome-192x192.png" width="88" height="88" alt="" />
      <div className="kicker">RAK 3022 × NUBI</div>
      {st.phase === "start" && (<>
        <h1>Link up, operative</h1>
        <p>Sign in with Glyph to post your runs to the leaderboards and play with your Rare Apepes, Zombie Apepes, Odyssey or Loot as your player card.</p>
        <button className="btn" disabled={!ready} onClick={() => login()}>{ready ? "Sign in with Glyph" : "Loading…"}</button>
        <p className="fine">You only sign in. Nothing is ever sent from your wallet.</p>
      </>)}
      {st.phase === "working" && (<><h1>One moment</h1><p>{st.msg}</p><div className="spin" /></>)}
      {st.phase === "error" && (<>
        <h1>Signal lost</h1><p>{st.msg}</p>
        <button className="btn" onClick={() => (authenticated ? issue(false) : login())}>Try again</button>
      </>)}
      {st.phase === "done" && prof && (<>
        <h1>{holds ? "You're in" : "Signed in"}</h1>
        <div className="who">
          {prof.avatar && prof.avatar.img ? <img src={prof.avatar.img} alt="" referrerPolicy="no-referrer" /> : null}
          <div><b>{prof.name}</b><span>{prof.wallets.map((w) => short(w.address)).join(" · ") || "no wallet found"}</span></div>
        </div>
        {holds ? (
          <p>{prof.collections.filter((c) => prof.badges[c.key]).map((c) => prof.badges[c.key] + " " + c.name).join(" · ")} found. Pick your player card in the game's Profile tab.</p>
        ) : (
          <p>No Apepes found in your Glyph wallets. If they're in another wallet (MetaMask, Rainbow, a Ledger…), link it to bring them in-game. Linking only proves you own it.</p>
        )}
        <button className="btn" onClick={() => linkWallet()}>{holds ? "Link another wallet" : "Link the wallet that holds them"}</button>
        <button className="btn ghost" onClick={back}>Back to the game</button>
      </>)}
    </div>
  );
}

export default function RakSignIn() {
  const [ret, setRet] = useState(null);
  useEffect(() => { setRet(readReturn()); }, []);
  const off = (msg) => <div className="card"><div className="kicker">RAK 3022 × NUBI</div><h1>Sign-in unavailable</h1><p>{msg}</p></div>;
  return (
    <main className="wrap">
      <style jsx global>{`
        html, body { margin: 0; background: #06030e; color: #efeaff; font-family: "Share Tech Mono", ui-monospace, monospace; }
        .wrap { min-height: 100dvh; display: grid; place-items: center; padding: 24px 16px; box-sizing: border-box;
          background: radial-gradient(60% 50% at 50% 0%, rgba(168,85,247,.22), transparent 70%), #06030e; }
        .card { width: 100%; max-width: 400px; text-align: center; padding: 28px 22px; border-radius: 18px; box-sizing: border-box;
          background: linear-gradient(180deg, rgba(23,14,48,.92), rgba(12,7,28,.92)); border: 1px solid rgba(167,139,250,.28);
          box-shadow: 0 0 0 1px rgba(0,0,0,.4), 0 24px 60px rgba(88,28,135,.35); }
        .nubi { border-radius: 50%; border: 2px solid rgba(168,85,247,.7); box-shadow: 0 0 28px rgba(168,85,247,.55); }
        .kicker { margin-top: 14px; font: 700 11px/1 Orbitron, sans-serif; letter-spacing: .28em; color: #c4b5fd; }
        h1 { font: 900 22px/1.2 Orbitron, sans-serif; margin: 10px 0 8px; letter-spacing: .02em; }
        p { color: #b9aedb; font-size: 14px; line-height: 1.55; margin: 0 0 18px; }
        .fine { font-size: 12px; color: #8b80ad; margin: 12px 0 0; }
        .btn { display: block; width: 100%; min-height: 48px; margin-top: 10px; border: 0; border-radius: 12px; cursor: pointer;
          font: 700 14px/1 Orbitron, sans-serif; letter-spacing: .06em; color: #0b0618;
          background: linear-gradient(90deg, #c084fc, #a855f7); box-shadow: 0 8px 24px rgba(168,85,247,.35); }
        .btn:disabled { opacity: .5; cursor: default; }
        .btn.ghost { background: transparent; color: #e9d5ff; border: 1px solid rgba(196,181,253,.4); box-shadow: none; }
        .btn:focus-visible { outline: 2px solid #f5d0fe; outline-offset: 2px; }
        .who { display: flex; gap: 12px; align-items: center; text-align: left; margin: 4px 0 14px; padding: 10px; border-radius: 12px; background: rgba(255,255,255,.04); }
        .who img { width: 48px; height: 48px; border-radius: 10px; object-fit: cover; }
        .who b { display: block; font-family: Orbitron, sans-serif; font-size: 14px; }
        .who span { font-size: 12px; color: #a79bc9; word-break: break-all; }
        .spin { width: 28px; height: 28px; margin: 4px auto 0; border-radius: 50%; border: 3px solid rgba(196,181,253,.25); border-top-color: #c084fc; animation: s 0.9s linear infinite; }
        @keyframes s { to { transform: rotate(360deg); } }
        @media (prefers-reduced-motion: reduce) { .spin { animation-duration: 3s; } }
      `}</style>
      {!ret ? null : !PRIVY_APP_ID ? off("The wallet layer isn't configured on this site.") : (
        <Boundary fallback={off("The wallet layer failed to load. Refresh and try again.")}>
          <GlyphPrivyProvider appId={PRIVY_APP_ID}>
            <Flow ret={ret} />
          </GlyphPrivyProvider>
        </Boundary>
      )}
    </main>
  );
}
