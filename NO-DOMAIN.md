# Go live with NO domain (and $0) — NduCare

You get free HTTPS URLs from both hosts. Later, when you buy a domain, you attach it in two dashboards — no code changes.

```
Frontend:  https://<your-name>.netlify.app          ← Netlify, free forever
Backend:   https://nducare-api.fly.dev              ← Fly.io, free HTTPS subdomain (~$2–3/mo)
       or  https://nducare-api.onrender.com         ← Render (free tier sleeps; Starter $7 doesn't)
```

Why not Oracle/Hetzner without a domain? A bare IP can't get a normal HTTPS certificate, and the browser
**refuses camera/mic and push over plain HTTP**. Fly/Render give you a real `https://…` hostname for free,
so use one of them until you own a domain.

---

## Fastest path: Fly.io backend + Netlify frontend (≈ 20 min)

### A. Backend on Fly.io
1. Install the CLI and sign up (card required, but the setup below costs ~$2–3/mo; many months round to $0 under their $5 waiver):
   ```bash
   curl -L https://fly.io/install.sh | sh      # macOS/Linux
   # Windows PowerShell:  iwr https://fly.io/install.ps1 -useb | iex
   fly auth signup
   ```
2. From inside the `nducare` folder:
   ```bash
   fly launch --copy-config --no-deploy
   ```
   - App name: type something unique, e.g. **`nducare-api-<yourname>`** → your URL becomes `https://nducare-api-<yourname>.fly.dev`
   - Region: **jnb** (Johannesburg) — already set in fly.toml
   - Say **No** to Postgres/Redis. Say **No** to deploying now.
3. Create the disk and secrets, then deploy:
   ```bash
   fly volumes create nducare_data --size 1 --region jnb --yes
   fly secrets set JWT_SECRET=$(openssl rand -hex 32) \
     CORS_ORIGIN=https://PLACEHOLDER.netlify.app \
     FRONTEND_URL=https://PLACEHOLDER.netlify.app \
     VAPID_SUBJECT=mailto:you@gmail.com
   fly deploy
   ```
   (We'll fix `PLACEHOLDER` in step C once Netlify gives you your URL.)
4. Check: open `https://nducare-api-<yourname>.fly.dev/api/health` → `{"ok":true,...}` ✅

> **Windows without openssl?** Use any long random string for JWT_SECRET, e.g. paste from https://generate-secret.vercel.app/32

### B. Frontend on Netlify
1. Edit `public/config.js` → `window.NC_API = 'https://nducare-api-<yourname>.fly.dev';`
2. Push to GitHub:
   ```bash
   git add -A && git commit -m "point frontend at fly API"
   git remote add origin https://github.com/<you>/nducare.git   # create an empty repo on GitHub first
   git push -u origin main
   ```
3. **app.netlify.com → Add new site → Import an existing project → GitHub → nducare → Deploy.**
   `netlify.toml` already sets publish dir + SPA redirect; no build settings needed.
4. Netlify gives you a random name like `https://silly-otter-1234.netlify.app`.
   **Rename it:** Site configuration → Site details → *Change site name* → e.g. `nducare` → `https://nducare.netlify.app` (if taken, add your name).

### C. Tell the backend about the frontend URL (CORS)
```bash
fly secrets set CORS_ORIGIN=https://nducare.netlify.app FRONTEND_URL=https://nducare.netlify.app
```
(Fly restarts the app automatically.) Done — open `https://nducare.netlify.app`.

**Test the video call:** phone 1 → sign in `adaeze@nducare.ng / doctor123`. Phone 2 → sign up as a patient, book Dr. Adaeze.
Doctor accepts → *Start video call* → phone 2 rings.

### D. Add TURN (2 min, free) — do this before showing real users on mobile data
metered.ca → sign up → *TURN Servers* → copy credentials → `public/config.js`:
```js
window.NC_TURN = { urls: ['turn:a.relay.metered.ca:80', 'turn:a.relay.metered.ca:443?transport=tcp'], username: '…', credential: '…' };
```
`git push` → Netlify redeploys automatically.

---

## Alternative backend: Render (no CLI, all in the browser)
1. GitHub repo pushed (step B2 above).
2. **render.com → New → Blueprint → pick repo → Apply.** Free HTTPS URL: `https://nducare-xxxx.onrender.com`.
3. Environment → set `CORS_ORIGIN` and `FRONTEND_URL` to your Netlify URL.
4. ⚠️ Choose **Starter ($7/mo)**. The Free instance sleeps after 15 min and **deletes your database** on spin-down — doctors go offline and phones don't ring. If money is the priority, Fly above is cheaper.

---

## When you buy a domain later (5 minutes, no code changes)
Cheapest registrars: Namecheap / Porkbun / Cloudflare (~$10/yr for .com; `.com.ng` ≈ ₦5–8k via Whogohost/Qservers).

1. **Netlify** → Domain management → Add `app.yourdomain.com` → add the CNAME they show. HTTPS auto.
2. **Fly** → `fly certs add api.yourdomain.com` → add the CNAME/A records it prints.
3. Update three strings:
   - `public/config.js` → `window.NC_API = 'https://api.yourdomain.com'` → push
   - `fly secrets set CORS_ORIGIN=https://app.yourdomain.com,https://nducare.netlify.app FRONTEND_URL=https://app.yourdomain.com`
4. Optionally move the backend to Oracle Free / Hetzner then (DEPLOY.md / NETLIFY.md) — a domain is what makes those possible.

---

## Free-URL cost table
| Setup | Monthly |
|---|---|
| Netlify + Fly.io (256 MB + 1 GB volume) | **~$2–3** |
| Netlify + Render Starter | $7 |
| Netlify + Render Free | $0 but **not usable** for live care (sleeps, wipes DB) |
