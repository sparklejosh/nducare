# NduCare for ₦0 / $0 — Netlify + Render Free + Turso + cron-job.org

Yes, you can run this **completely free**, and yes, the "ping trick" works. This guide is the honest version:
what breaks on free tiers, what I changed in the code so it doesn't, and the exact clicks.

```
Browser ──▶ Netlify (frontend)            free, never sleeps
        └─▶ Render Free (API + WebSocket) free, sleeps after 15 min idle  ──▶ kept awake by cron-job.org (free)
                 │
                 └─▶ Turso (database snapshot)  free 5 GB — survives Render wiping its disk
```

## The two problems with Render Free — and the fixes

| Problem | What happens | Fix (already built in) |
|---|---|---|
| **Sleeps after 15 min idle** | Doctor shows offline, phone doesn't ring, 30–60 s wake-up | **cron-job.org** pings `/api/health` every 10 min (free, unlimited). Plus the app can self-ping (`KEEPALIVE_URL`). |
| **No disk — files erased on every restart/deploy** | Your SQLite database, all users and consultations **vanish** | New `persist.js`: after every write the whole DB (≈7 KB gzipped) is snapshotted to **Turso** (free hosted SQLite). On boot, if the local file is missing, it restores from Turso. Tested: delete DB → restart → users still there ✓ |

Still true on free: Render restarts your service once a day-ish and on each deploy (≈40 s downtime; anyone in a
video call keeps talking because WebRTC is peer-to-peer, but chat/ring pause), 512 MB RAM (plenty), and 750 free
hours/month — **one service running 24/7 is exactly 744 h, so run only ONE free web service in the account.**

---

## Step 1 — Turso (free database backup) — 3 min
1. https://turso.tech → *Sign up* (GitHub login, **no card**).
2. *Create Database* → name `nducare` → region **Frankfurt** (closest to Render's Frankfurt region) → Create.
3. Click the database → copy the **URL** (`libsql://nducare-<you>.turso.io`).
4. *Generate Token* (or **Create Token**) → copy the long `eyJ…` string.

## Step 2 — GitHub — 2 min
Create an empty repo `nducare`, then:
```bash
cd nducare
git remote add origin https://github.com/<you>/nducare.git
git push -u origin main
```

## Step 3 — Render Free (backend) — 5 min
1. https://render.com → *New +* → **Web Service** → connect the GitHub repo.
2. Settings:
   - Name: `nducare-api` (your URL becomes `https://nducare-api.onrender.com`; if taken, add your name)
   - Region: **Frankfurt**
   - Runtime: Node · Build: `npm ci` · Start: `node server.js`
   - Instance type: **Free**
3. *Environment* → Add:
   | Key | Value |
   |---|---|
   | `NODE_ENV` | `production` |
   | `TURSO_DATABASE_URL` | `libsql://nducare-<you>.turso.io` |
   | `TURSO_AUTH_TOKEN` | `eyJ…` |
   | `DB_PATH` | `/tmp/nducare.db` |
   | `CORS_ORIGIN` | `https://nducare.netlify.app` *(your Netlify URL — fix in step 5)* |
   | `FRONTEND_URL` | `https://nducare.netlify.app` |
   | `KEEPALIVE_URL` | `https://nducare-api.onrender.com/api/health` |
   | `VAPID_SUBJECT` | `mailto:you@gmail.com` |
4. *Create Web Service*. First deploy ≈ 3 min. Open `https://nducare-api.onrender.com/api/health` → you should see `"persist":{"enabled":true…}` ✅

> No `JWT_SECRET`? Fine — it's generated once and stored **inside the database** (so it survives via Turso). Same for push keys.

## Step 4 — Netlify (frontend) — 3 min
1. Edit `public/config.js` → `window.NC_API = 'https://nducare-api.onrender.com';` → `git add -A && git commit -m api && git push`
2. https://app.netlify.com → *Add new site* → *Import an existing project* → GitHub → `nducare` → **Deploy** (settings come from `netlify.toml`).
3. *Site configuration → Site details → Change site name* → `nducare` (or `nducare-<you>`).

## Step 5 — Connect them
Back in Render → *Environment* → set `CORS_ORIGIN` and `FRONTEND_URL` to your **exact** Netlify URL (e.g. `https://nducare-<you>.netlify.app`) → *Save* (auto-redeploys).

## Step 6 — Keep it awake: cron-job.org — 2 min
1. https://cron-job.org → sign up (free, no card).
2. *Create cronjob* → URL `https://nducare-api.onrender.com/api/health` → schedule **every 10 minutes** → Save.
   (Optional: enable *notifications on failure* — free uptime monitoring.)

Render never sees 15 idle minutes → never sleeps. (Render's ToS allows this for hobby use; many people do it.)

## Step 7 — TURN for video (free) — 2 min
https://www.metered.ca/stun-turn → free plan → copy credentials → `public/config.js`:
```js
window.NC_TURN = { urls: ['turn:a.relay.metered.ca:80','turn:a.relay.metered.ca:443?transport=tcp'], username: '…', credential: '…' };
```
`git push` → Netlify redeploys.

## ✅ Test
Phone 1: `https://nducare-<you>.netlify.app` → sign in `adaeze@nducare.ng / doctor123`.
Phone 2: sign up as a patient → book Dr. Adaeze → doctor accepts → *Start video call* → phone 2 rings.

---

## Later: upgrade path (when you have money / a domain)
- Money first: Render **Starter $7** → persistent, no sleep. Keep Turso as free off-site backup (it just keeps working).
- Domain: add in Netlify + Render dashboards, update `NC_API` + `CORS_ORIGIN`. Five minutes, no code changes.
- Both: move backend to a $0 Oracle VM or €3.79 Hetzner (NETLIFY.md).

## Troubleshooting
| Symptom | Cause / fix |
|---|---|
| Browser console: *CORS blocked* | `CORS_ORIGIN` on Render must equal the Netlify origin exactly (https, no trailing slash) |
| Doctor shows offline even when logged in | Render was asleep — check cron-job.org is running; check `/api/health` `uptime_s` |
| Users disappear after a deploy | `TURSO_*` vars missing/wrong. `/api/health` → `persist.enabled` must be `true`; Render logs show `[persist] restored database` on boot |
| Video connects on Wi‑Fi but not on mobile data | Add TURN (step 7) |
| "Too many attempts" | Rate limiter — wait 1 minute |
