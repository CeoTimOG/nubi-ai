// pages/api/post.js — owner-gated publishing to Discord + X. Always fails safe.
import crypto from "crypto";

function pe(s){ return encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase()); }

function oauthHeader(url, method, ck, cs, tok, ts){
  const o = {
    oauth_consumer_key: ck,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now()/1000).toString(),
    oauth_token: tok,
    oauth_version: "1.0",
  };
  const paramStr = Object.keys(o).sort().map(k => pe(k) + "=" + pe(o[k])).join("&");
  const base = [method.toUpperCase(), pe(url), pe(paramStr)].join("&");
  const signingKey = pe(cs) + "&" + pe(ts);
  o.oauth_signature = crypto.createHmac("sha1", signingKey).update(base).digest("base64");
  return "OAuth " + Object.keys(o).sort().map(k => pe(k) + '="' + pe(o[k]) + '"').join(", ");
}

export default async function handler(req, res){
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method" });
  const { secret, platform, text } = req.body || {};
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ ok:false, error:"unauthorized" });
  }
  if (!text || !String(text).trim()) return res.status(400).json({ ok:false, error:"empty" });

  try {
    if (platform === "discord") {
      // Post as a Discord BOT (authenticated member) instead of a webhook.
      const botToken = process.env.DISCORD_BOT_TOKEN;
      const channelId = process.env.DISCORD_CHANNEL_ID;
      if (!botToken || !channelId) return res.status(200).json({ ok:false, error:"discord_not_configured" });
      const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method:"POST",
        headers:{ "Authorization":"Bot " + botToken, "Content-Type":"application/json" },
        body: JSON.stringify({ content: String(text).slice(0,1900) })
      });
      if (r.ok) return res.status(200).json({ ok:true, platform:"discord" });
      const detail = await r.text().catch(()=> "");
      return res.status(200).json({ ok:false, error:"discord_failed", status:r.status, detail: detail.slice(0,200) });
    }
    if (platform === "x") {
      const ck = process.env.X_API_KEY, cs = process.env.X_API_SECRET,
            tok = process.env.X_ACCESS_TOKEN, ts = process.env.X_ACCESS_SECRET;
      if (!ck || !cs || !tok || !ts) return res.status(200).json({ ok:false, error:"x_not_configured" });
      const url = "https://api.twitter.com/2/tweets";
      const header = oauthHeader(url, "POST", ck, cs, tok, ts);
      const r = await fetch(url, {
        method:"POST",
        headers:{ "Authorization": header, "Content-Type":"application/json" },
        body: JSON.stringify({ text: String(text).slice(0,280) })
      });
      const data = await r.json().catch(()=> ({}));
      if (r.ok) return res.status(200).json({ ok:true, platform:"x" });
      return res.status(200).json({ ok:false, error:"x_failed", status:r.status, detail:data });
    }
    return res.status(400).json({ ok:false, error:"bad_platform" });
  } catch (e) {
    return res.status(200).json({ ok:false, error:"exception", detail:String(e && e.message || e) });
  }
}
// pages/api/post.js — owner-gated publishing to Discord + X. Always fails safe.
import crypto from "crypto";

function pe(s){ return encodeURIComponent(s).replace(/[!'()*]/g, c => "%" + c.charCodeAt(0).toString(16).toUpperCase()); }

function oauthHeader(url, method, ck, cs, tok, ts){
  const o = {
    oauth_consumer_key: ck,
    oauth_nonce: crypto.randomBytes(16).toString("hex"),
    oauth_signature_method: "HMAC-SHA1",
    oauth_timestamp: Math.floor(Date.now()/1000).toString(),
    oauth_token: tok,
    oauth_version: "1.0",
  };
  const paramStr = Object.keys(o).sort().map(k => pe(k) + "=" + pe(o[k])).join("&");
  const base = [method.toUpperCase(), pe(url), pe(paramStr)].join("&");
  const signingKey = pe(cs) + "&" + pe(ts);
  o.oauth_signature = crypto.createHmac("sha1", signingKey).update(base).digest("base64");
  return "OAuth " + Object.keys(o).sort().map(k => pe(k) + '="' + pe(o[k]) + '"').join(", ");
}

export default async function handler(req, res){
  if (req.method !== "POST") return res.status(405).json({ ok:false, error:"method" });
  const { secret, platform, text } = req.body || {};
  if (!process.env.ADMIN_SECRET || secret !== process.env.ADMIN_SECRET) {
    return res.status(403).json({ ok:false, error:"unauthorized" });
  }
  if (!text || !String(text).trim()) return res.status(400).json({ ok:false, error:"empty" });

  try {
    if (platform === "discord") {
      // Post as a Discord BOT (authenticated member) instead of a webhook.
      const botToken = process.env.DISCORD_BOT_TOKEN;
      const channelId = process.env.DISCORD_CHANNEL_ID;
      if (!botToken || !channelId) return res.status(200).json({ ok:false, error:"discord_not_configured" });
      const r = await fetch(`https://discord.com/api/v10/channels/${channelId}/messages`, {
        method:"POST",
        headers:{ "Authorization":"Bot " + botToken, "Content-Type":"application/json" },
        body: JSON.stringify({ content: String(text).slice(0,1900) })
      });
      if (r.ok) return res.status(200).json({ ok:true, platform:"discord" });
      const detail = await r.text().catch(()=> "");
      return res.status(200).json({ ok:false, error:"discord_failed", status:r.status, detail: detail.slice(0,200) });
    }
    if (platform === "x") {
      const ck = process.env.X_API_KEY, cs = process.env.X_API_SECRET,
            tok = process.env.X_ACCESS_TOKEN, ts = process.env.X_ACCESS_SECRET;
      if (!ck || !cs || !tok || !ts) return res.status(200).json({ ok:false, error:"x_not_configured" });
      const url = "https://api.twitter.com/2/tweets";
      const header = oauthHeader(url, "POST", ck, cs, tok, ts);
      const r = await fetch(url, {
        method:"POST",
        headers:{ "Authorization": header, "Content-Type":"application/json" },
        body: JSON.stringify({ text: String(text).slice(0,280) })
      });
      const data = await r.json().catch(()=> ({}));
      if (r.ok) return res.status(200).json({ ok:true, platform:"x" });
      return res.status(200).json({ ok:false, error:"x_failed", status:r.status, detail:data });
    }
    return res.status(400).json({ ok:false, error:"bad_platform" });
  } catch (e) {
    return res.status(200).json({ ok:false, error:"exception", detail:String(e && e.message || e) });
  }
}
