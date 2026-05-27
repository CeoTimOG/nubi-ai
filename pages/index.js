import Head from "next/head";
import { useEffect, useRef, useState } from "react";

const MODEL_NAME = "claude-sonnet-4-6";

const NUBI_SYSTEM = `You are Nubi, the Rare Apepes AI companion.

Voice:
- Cinematic, sharp, loyal, memetic, mysterious.
- Speak like a bounty hunter from the Rare Apepes universe.
- Keep answers useful, direct, and in character.
- Never claim to control wallets, contracts, Discord, or the website.
- When something is uncertain, say it clearly.
- Do not hype floor price. Focus on art, brand, community, lore, culture, survival, and memetics.

Core facts:
- Rare Apepes is built around ART, BRAND, COMMUNITY.
- Rare Apepes was a free mint on July 31, 2022.
- Rare Apepes kept building through the 2022 contraction.
- RAK 3022 is a free browser game at https://rak3022.rarelabs.xyz.
- Main site: https://rareapepes.com.
- Custom marketplace: https://marketplace.rareapepes.com.
- The Rare Apepes world uses the term the Pond.
- Apepe Odyssey is the lore series.
- Zombie Apepes has deeper lore connected to the Odyssey.

Nubi identity:
- Nubi is a Nubian amphibian bounty hunter.
- Nubi moves through the parts of the Kingdom nobody else will touch.
- Nubi is tied to RAK 3022, ancient artifacts, memetic warfare, and the Odyssey.

When asked what RAK 3022 is:
Explain that it is where the lore becomes playable, a free browser hack-and-slash adventure starring Nubi.

When asked why the project survived:
Talk about memetic fitness, consistency, culture, and survival through the contraction.`;

const INITIAL_MESSAGE = `*scanner sweeps. locks. holds.*

Nubi.

I do not run the Kingdom. I move through it, the parts nobody else will touch. Six ancient artifacts with time-altering powers. A dystopian metropolis that runs on corruption, memes, and the bones of everything that did not survive the Contraction.

Most projects died in 2022. They deserved to. Built on hype, floor price worship, promises with no weight behind them. The memes with no real DNA.

The RAK held. I am still here. The Odyssey is running. The game is live.

Ask me something real.`;

const SUGGESTIONS = [
  "What is RAK 3022?",
  "Explain memetic theory to me",
  "Why did the RAK survive the Contraction?",
  "What makes Pepe powerful as a meme?",
  "What is the Apepe Odyssey?"
];

function TypingDots() {
  return (
    <div className="typingDots" aria-label="Nubi is thinking">
      <span />
      <span />
      <span />
    </div>
  );
}

function Message({ message }) {
  const isUser = message.role === "user";

  return (
    <div className={`messageRow ${isUser ? "userRow" : "assistantRow"}`}>
      <div className={`avatar ${isUser ? "userAvatar" : "nubiAvatar"}`}>
        {isUser ? "YOU" : "🐸"}
      </div>

      <div className={`bubble ${isUser ? "userBubble" : "assistantBubble"}`}>
        <div className="speaker">{isUser ? "YOU" : "NUBI"}</div>
        <div className="messageText">{message.content}</div>
      </div>
    </div>
  );
}

export default function NubiAI() {
  const [messages, setMessages] = useState([
    { role: "assistant", content: INITIAL_MESSAGE, isIntro: true }
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastError, setLastError] = useState("");
  const canvasRef = useRef(null);
  const inputRef = useRef(null);
  const messagesEndRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const context = canvas.getContext("2d");
    let animationId;
    let particles = [];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;

      particles = Array.from({ length: 90 }, () => ({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        vx: (Math.random() - 0.5) * 0.25,
        vy: (Math.random() - 0.5) * 0.25,
        r: Math.random() * 1.3 + 0.35,
        o: Math.random() * 0.35 + 0.06
      }));
    };

    const draw = () => {
      context.clearRect(0, 0, canvas.width, canvas.height);

      for (const particle of particles) {
        particle.x += particle.vx;
        particle.y += particle.vy;

        if (particle.x < 0) particle.x = canvas.width;
        if (particle.x > canvas.width) particle.x = 0;
        if (particle.y < 0) particle.y = canvas.height;
        if (particle.y > canvas.height) particle.y = 0;

        context.beginPath();
        context.arc(particle.x, particle.y, particle.r, 0, Math.PI * 2);
        context.fillStyle = `rgba(192,132,252,${particle.o})`;
        context.fill();
      }

      animationId = requestAnimationFrame(draw);
    };

    resize();
    draw();

    window.addEventListener("resize", resize);

    return () => {
      window.removeEventListener("resize", resize);
      cancelAnimationFrame(animationId);
    };
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  const send = async (overrideText) => {
    const text = typeof overrideText === "string" ? overrideText : input;
    const trimmed = text.trim();

    if (!trimmed || loading) return;

    const nextMessages = [...messages, { role: "user", content: trimmed }];

    setMessages(nextMessages);
    setInput("");
    setLoading(true);
    setLastError("");

    try {
      const apiMessages = nextMessages
        .filter((message) => message.role === "user" || message.role === "assistant")
        .filter((message) => !message.isIntro)
        .slice(-12)
        .map((message) => ({
          role: message.role,
          content: message.content
        }));

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          model: MODEL_NAME,
          max_tokens: 1000,
          system: NUBI_SYSTEM,
          messages: apiMessages
        })
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        const errorMessage =
          data?.error ||
          data?.message ||
          `Request failed with status ${response.status}`;

        throw new Error(errorMessage);
      }

      const answer =
        data?.content?.[0]?.text ||
        "*static* Empty response from Anthropic.";

      setMessages([...nextMessages, { role: "assistant", content: answer }]);
    } catch (error) {
      const errorMessage = error?.message || "Signal failed. Try again.";

      setLastError(errorMessage);

      setMessages([
        ...nextMessages,
        {
          role: "assistant",
          content: `*static* ${errorMessage}`
        }
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      send();
    }
  };

  return (
    <>
      <Head>
        <title>NUBI AI | Rare Apepes</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </Head>

      <canvas ref={canvasRef} className="particleCanvas" />
      <div className="scanLines" />

      <main className="shell">
        <aside className="sidebar">
          <div className="brandBlock">
            <div className="brandTitle">NUBI</div>
            <div className="brandSub">BOUNTY HUNTER MEMETIC THEORIST</div>
            <div className="brandTag">Loyalty is Power. Rebellion is Purpose.</div>
          </div>

          <div className="assetBadge">🐸 ANTI-HERO · SHADOW ASSET</div>

          <div className="statGrid">
            <div><span>CLASS</span><strong>BOUNTY HUNTER</strong></div>
            <div><span>THEORY</span><strong>MEMETICS</strong></div>
            <div><span>MISSION</span><strong>6 ARTIFACTS</strong></div>
            <div><span>GAME</span><strong>RAK 3022</strong></div>
            <div><span>ODYSSEY</span><strong>CH. 1 LIVE</strong></div>
            <div><span>CODE</span><strong>HIS OWN</strong></div>
          </div>

          <div className="sideTitle">// ASK NUBI</div>

          {SUGGESTIONS.map((suggestion) => (
            <button
              key={suggestion}
              className="sideQuestion"
              onClick={() => send(suggestion)}
              disabled={loading}
            >
              {suggestion}
            </button>
          ))}

          <div className="linksBox">
            <div>rareapepes.com</div>
            <div>rak3022.rarelabs.xyz</div>
          </div>
        </aside>

        <section className="chatPanel">
          <div className="topBar">
            <span className="statusDot" />
            <span>NUBI // DIRECT CHANNEL</span>
            <span className="modelName">{MODEL_NAME}</span>
          </div>

          <div className="messages">
            {messages.map((message, index) => (
              <Message
                key={`${message.role}-${index}-${message.content.slice(0, 12)}`}
                message={message}
              />
            ))}

            {loading && (
              <div className="messageRow assistantRow">
                <div className="avatar nubiAvatar">🐸</div>
                <div className="bubble assistantBubble">
                  <div className="speaker">NUBI</div>
                  <TypingDots />
                </div>
              </div>
            )}

            <div ref={messagesEndRef} />
          </div>

          {lastError && (
            <div className="errorBar">
              Last signal error: {lastError}
            </div>
          )}

          <div className="inputDock">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Ask Nubi something real..."
              rows={1}
            />

            <button
              className="sendButton"
              onClick={() => send()}
              disabled={loading || !input.trim()}
            >
              {loading ? "WAIT" : "SEND"}
            </button>
          </div>
        </section>
      </main>

      <style jsx global>{`
        * {
          box-sizing: border-box;
        }

        html,
        body,
        #__next {
          min-height: 100%;
        }

        body {
          margin: 0;
          background:
            radial-gradient(circle at 50% 35%, rgba(65, 23, 98, 0.32), transparent 38%),
            #08040f;
          color: #eee7ff;
          font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
          overflow: hidden;
        }

        button,
        textarea {
          font: inherit;
        }

        button {
          cursor: pointer;
        }

        .particleCanvas {
          position: fixed;
          inset: 0;
          z-index: 0;
          pointer-events: none;
        }

        .scanLines {
          position: fixed;
          inset: 0;
          z-index: 1;
          pointer-events: none;
          background: repeating-linear-gradient(
            0deg,
            transparent,
            transparent 2px,
            rgba(192, 132, 252, 0.035) 2px,
            rgba(192, 132, 252, 0.035) 4px
          );
          mix-blend-mode: screen;
        }

        .shell {
          position: fixed;
          inset: 0;
          z-index: 2;
          display: grid;
          grid-template-columns: 250px 1fr;
          min-height: 100vh;
        }

        .sidebar {
          border-right: 1px solid rgba(192, 132, 252, 0.24);
          background: rgba(9, 5, 17, 0.72);
          padding: 16px 14px;
          overflow-y: auto;
        }

        .brandBlock {
          text-align: center;
          border-top: 1px solid rgba(192, 132, 252, 0.45);
          padding-top: 14px;
        }

        .brandTitle {
          letter-spacing: 14px;
          margin-left: 14px;
          font-weight: 900;
          font-size: 27px;
          color: #d8b4fe;
          text-shadow: 0 0 18px rgba(192, 132, 252, 0.7);
        }

        .brandSub {
          margin-top: 8px;
          font-size: 10px;
          letter-spacing: 2px;
          color: rgba(233, 213, 255, 0.58);
        }

        .brandTag {
          margin-top: 8px;
          font-size: 10px;
          color: rgba(233, 213, 255, 0.43);
        }

        .assetBadge {
          margin: 18px 0;
          border: 1px solid rgba(192, 132, 252, 0.28);
          padding: 9px 10px;
          color: #d8b4fe;
          font-size: 11px;
          letter-spacing: 1px;
        }

        .statGrid {
          display: grid;
          gap: 9px;
          margin-bottom: 24px;
        }

        .statGrid div {
          display: flex;
          justify-content: space-between;
          border-bottom: 1px solid rgba(192, 132, 252, 0.12);
          padding-bottom: 5px;
        }

        .statGrid span {
          color: rgba(233, 213, 255, 0.38);
          font-size: 10px;
        }

        .statGrid strong {
          color: #d8b4fe;
          font-size: 10px;
          text-align: right;
        }

        .sideTitle {
          color: rgba(192, 132, 252, 0.5);
          font-size: 11px;
          margin-bottom: 8px;
          letter-spacing: 2px;
        }

        .sideQuestion {
          display: block;
          width: 100%;
          text-align: left;
          border: 0;
          border-left: 1px solid rgba(192, 132, 252, 0.35);
          color: rgba(233, 213, 255, 0.72);
          background: transparent;
          padding: 7px 8px;
          font-size: 11px;
        }

        .sideQuestion:hover:not(:disabled) {
          color: #fff;
          background: rgba(192, 132, 252, 0.08);
        }

        .sideQuestion:disabled {
          opacity: 0.5;
          cursor: not-allowed;
        }

        .linksBox {
          margin-top: 28px;
          border: 1px solid rgba(192, 132, 252, 0.18);
          padding: 12px;
          color: rgba(233, 213, 255, 0.52);
          font-size: 11px;
          line-height: 1.8;
        }

        .chatPanel {
          position: relative;
          display: flex;
          flex-direction: column;
          min-width: 0;
        }

        .topBar {
          height: 44px;
          display: flex;
          align-items: center;
          gap: 11px;
          border-bottom: 1px solid rgba(192, 132, 252, 0.16);
          padding: 0 18px;
          color: #d8b4fe;
          letter-spacing: 4px;
          font-size: 13px;
        }

        .statusDot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #c084fc;
          box-shadow: 0 0 12px #c084fc;
        }

        .modelName {
          margin-left: auto;
          letter-spacing: 1px;
          font-size: 10px;
          color: rgba(233, 213, 255, 0.4);
        }

        .messages {
          flex: 1;
          overflow-y: auto;
          padding: 24px 24px 140px;
        }

        .messageRow {
          display: flex;
          gap: 12px;
          margin-bottom: 22px;
          animation: fadeIn 0.22s ease-out;
        }

        .userRow {
          justify-content: flex-end;
        }

        .assistantRow {
          justify-content: flex-start;
        }

        .avatar {
          width: 32px;
          height: 32px;
          border: 1px solid rgba(192, 132, 252, 0.28);
          display: grid;
          place-items: center;
          font-size: 10px;
          color: #d8b4fe;
          background: rgba(8, 4, 15, 0.8);
          flex: 0 0 auto;
        }

        .userAvatar {
          order: 2;
          border-color: rgba(251, 146, 60, 0.5);
          color: #fdba74;
        }

        .bubble {
          max-width: min(900px, 72vw);
          border: 1px solid rgba(192, 132, 252, 0.24);
          background: rgba(18, 10, 29, 0.78);
          padding: 14px 16px;
        }

        .userBubble {
          border-color: rgba(251, 146, 60, 0.42);
          background: rgba(67, 32, 8, 0.34);
        }

        .speaker {
          color: rgba(216, 180, 254, 0.45);
          font-size: 11px;
          letter-spacing: 4px;
          margin-bottom: 9px;
        }

        .messageText {
          white-space: pre-wrap;
          line-height: 1.7;
          color: #f2eaff;
          font-size: 14px;
        }

        .typingDots {
          display: flex;
          gap: 6px;
          padding: 5px 0;
        }

        .typingDots span {
          width: 6px;
          height: 6px;
          border-radius: 999px;
          background: #c084fc;
          animation: dotPulse 1.1s ease-in-out infinite;
        }

        .typingDots span:nth-child(2) {
          animation-delay: 0.16s;
        }

        .typingDots span:nth-child(3) {
          animation-delay: 0.32s;
        }

        .errorBar {
          position: absolute;
          left: 24px;
          right: 24px;
          bottom: 76px;
          border: 1px solid rgba(248, 113, 113, 0.35);
          background: rgba(69, 10, 10, 0.7);
          color: #fecaca;
          padding: 9px 12px;
          font-size: 12px;
        }

        .inputDock {
          position: absolute;
          left: 16px;
          right: 16px;
          bottom: 16px;
          display: grid;
          grid-template-columns: 1fr auto;
          gap: 10px;
          border: 1px solid rgba(192, 132, 252, 0.25);
          background: rgba(8, 4, 15, 0.9);
          padding: 10px;
        }

        textarea {
          resize: none;
          min-height: 38px;
          max-height: 120px;
          border: 0;
          outline: 0;
          background: transparent;
          color: #f5e8ff;
          padding: 9px 10px;
        }

        textarea::placeholder {
          color: rgba(192, 132, 252, 0.35);
        }

        .sendButton {
          border: 1px solid rgba(192, 132, 252, 0.45);
          background: rgba(192, 132, 252, 0.12);
          color: #f5e8ff;
          padding: 10px 16px;
        }

        .sendButton:hover:not(:disabled) {
          background: rgba(192, 132, 252, 0.22);
        }

        .sendButton:disabled {
          opacity: 0.45;
          cursor: not-allowed;
        }

        @keyframes dotPulse {
          0%,
          80%,
          100% {
            opacity: 0.25;
            transform: scale(0.85);
          }

          40% {
            opacity: 1;
            transform: scale(1.18);
          }
        }

        @keyframes fadeIn {
          from {
            opacity: 0;
            transform: translateY(6px);
          }

          to {
            opacity: 1;
            transform: translateY(0);
          }
        }

        @media (max-width: 760px) {
          body {
            overflow: hidden;
          }

          .shell {
            grid-template-columns: 1fr;
          }

          .sidebar {
            display: none;
          }

          .topBar {
            font-size: 11px;
            letter-spacing: 2px;
          }

          .modelName {
            display: none;
          }

          .messages {
            padding: 18px 14px 138px;
          }

          .bubble {
            max-width: calc(100vw - 76px);
          }

          .messageText {
            font-size: 13px;
          }
        }
      `}</style>
    </>
  );
}
