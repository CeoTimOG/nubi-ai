// pages/api/voice.js — ElevenLabs TTS proxy (keeps key server-side). Fails safe.
export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).json({ error: "method" });
  const text = (req.body && req.body.text) ? String(req.body.text) : "";
  if (!text.trim()) return res.status(400).json({ error: "empty" });

  const key = process.env.ELEVENLABS_API_KEY;
  if (!key) return res.status(503).json({ error: "not_configured" });

  // Default voice: deep male ("Adam"). Override with ELEVENLABS_VOICE_ID env var.
  const voiceId = process.env.ELEVENLABS_VOICE_ID || "pNInz6obpgDQGcFmaJgB";

  try {
    const r = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
      {
        method: "POST",
        headers: {
          "xi-api-key": key,
          "Content-Type": "application/json",
          accept: "audio/mpeg",
        },
        body: JSON.stringify({
          text: text.slice(0, 800),
          model_id: "eleven_turbo_v2",
          voice_settings: { stability: 0.45, similarity_boost: 0.75, style: 0.3 },
        }),
      }
    );
    if (!r.ok) {
      const detail = await r.text().catch(() => "");
      return res.status(502).json({ error: "tts_failed", status: r.status, detail: detail.slice(0, 200) });
    }
    const buf = Buffer.from(await r.arrayBuffer());
    res.setHeader("Content-Type", "audio/mpeg");
    res.setHeader("Cache-Control", "no-store");
    return res.status(200).send(buf);
  } catch (e) {
    return res.status(500).json({ error: "exception", detail: String(e && e.message || e) });
  }
}

export const config = { api: { responseLimit: false } };
