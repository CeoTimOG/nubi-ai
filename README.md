# NUBI AI — Rare Apepes Companion
## Deploy to Vercel (Free — 15 min setup)

### What you need
- A free GitHub account (github.com)
- A free Vercel account (vercel.com)
- Your Anthropic API key (console.anthropic.com)

---

### STEP 1 — Upload to GitHub

1. Go to **github.com** → click the **+** icon → **New repository**
2. Name it `nubi-ai` → click **Create repository**
3. On the next page, click **uploading an existing file**
4. Drag the entire `nubi-ai` folder contents into the upload area
5. Click **Commit changes**

---

### STEP 2 — Deploy on Vercel

1. Go to **vercel.com** → click **Sign Up** → choose **Continue with GitHub**
2. Click **Add New → Project**
3. Find `nubi-ai` in the list → click **Import**
4. Leave all settings as default → click **Deploy**
5. Wait ~60 seconds — Vercel builds and deploys automatically

---

### STEP 3 — Add your API key (IMPORTANT)

Without this step the chat won't work.

1. In your Vercel dashboard, click your project → **Settings** tab
2. Click **Environment Variables** in the left sidebar
3. Add:
   - **Name:** `ANTHROPIC_API_KEY`
   - **Value:** your API key from console.anthropic.com
4. Click **Save**
5. Go back to **Deployments** → click the three dots on your latest deployment → **Redeploy**

---

### STEP 4 — Get your public URL

After redeployment completes, Vercel shows your URL:
`https://nubi-ai-xxxx.vercel.app`

That's it. Share that link anywhere — no login required for visitors.

---

### Setting an API budget limit (recommended)
To prevent unexpected costs if the link goes viral:
1. Go to **console.anthropic.com** → **Settings** → **Limits**
2. Set a monthly spend limit (e.g. $20)
3. Anthropic will stop the API after that amount — you'll never be surprised

---

### Your links to promote
- Game: https://rak3022.rarelabs.xyz
- Collection: https://opensea.io/collection/rare-apepes
- Discord: https://discord.gg/czW3CfqbKK

---

## Important fixed deployment structure

This Next.js project must keep files in this layout:

```text
nubi-ai/
  package.json
  next.config.js
  pages/
    index.js
    api/
      chat.js
```

Do not deploy `nubi-standalone.html`. It is not needed for the Vercel/Next.js version and can expose client-side secrets.

After uploading this folder to GitHub, set the Vercel environment variable:

```text
ANTHROPIC_API_KEY=your_anthropic_key_here
```

Then redeploy the project from Vercel.
