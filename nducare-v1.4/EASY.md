# NduCare — the EASY free deploy (no terminal, ~15 minutes)

**Is GitHub a must?** Almost. Render (your free backend) deploys *from* GitHub. Netlify can take a drag‑and‑drop
folder instead. So you do **one GitHub upload — by drag‑and‑drop in the browser, no git commands** — and click.

You'll create 4 free accounts: **GitHub, Turso, Render, Netlify**. None need a card.

---

## 1. GitHub — upload the code (3 min)
1. github.com → sign up → **New repository** → name `nducare` → *Public* → **Create**.
2. On the empty repo page click **"uploading an existing file"**.
3. Unzip `nducare-v1.4.zip` on your computer. Open the unzipped `nducare` folder and **drag everything inside it** (server.js, package.json, public/, etc. — *not* the outer folder) into the GitHub page. Wait for all files, then **Commit changes**.

## 2. Turso — free database backup (2 min)
1. turso.tech → **Sign up with GitHub**.
2. **Create Database** → name `nducare` → location **Frankfurt** → Create.
3. On the database page copy the **URL** (`libsql://nducare-….turso.io`) and click **Create token** → copy it. Keep both in a notes app.

## 3. Render — free backend (5 min)
1. render.com → **Sign up with GitHub**.
2. **New +** → **Blueprint** → select your `nducare` repo → it finds `render.yaml`.
3. It asks for two values: paste **TURSO_DATABASE_URL** and **TURSO_AUTH_TOKEN** → **Apply**.
4. Wait ~3 min. Click the service → copy its URL, e.g. `https://nducare-api.onrender.com`.
   Open `…/api/health` in a tab → you should see `"ok":true`.

## 4. Netlify — free frontend (2 min)
1. app.netlify.com → **Sign up with GitHub**.
2. **Add new site → Import an existing project → GitHub → nducare → Deploy** (no settings to change).
3. When it's live: **Site configuration → Change site name** → `nducare-<yourname>`.

## 5. Connect them — ONE link (10 seconds)
Open this URL **once** on each phone/browser you'll use (replace both parts):

```
https://nducare-<yourname>.netlify.app/?api=https://nducare-api.onrender.com
```
The app remembers the backend from then on. (If you ever see a "Connect to your backend" box on the login page, paste the Render URL there.)

Test: log in as **adaeze@nducare.ng / doctor123** on one device, sign up as a patient on another, book → accept → video call.

## 6. Keep it awake (2 min) — do this, or the free backend sleeps
cron-job.org → sign up → **Create cronjob** → URL `https://nducare-api.onrender.com/api/health` → **Every 10 minutes** → Save.

---

### That's it. Optional later:
- **Better video on mobile data:** metered.ca free TURN → in GitHub, open `public/config.js` → pencil icon → paste the `window.NC_TURN = {...}` line → Commit. Netlify redeploys itself.
- **Real payments:** Render → your service → Environment → add `PAYSTACK_SECRET_KEY` + `PAYSTACK_PUBLIC_KEY`.
- **Your own domain someday:** add it in Netlify (Domain management) — nothing else changes.
- **Updating the app:** upload changed files to GitHub the same drag‑and‑drop way → both Render and Netlify redeploy automatically.

### Why 4 accounts and not 1?
Netlify can't run the live video/WebSocket server; Render's free tier can, but it has no disk, so Turso keeps the database safe; cron‑job keeps Render awake. Each does the one thing it does for free.
