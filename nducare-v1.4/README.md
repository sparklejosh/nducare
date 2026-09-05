# NduCare — Telemedicine PWA

*Ndụ* means "life" in Igbo. NduCare lets patients see a licensed doctor over an encrypted
browser video call, receive a verifiable care plan (diagnosis, prescriptions, recommended tests),
and get turn-by-turn directions to the accredited laboratories and pharmacies closest to them.

**Everything works without third-party API keys:** WebRTC video with a built-in signaling server,
OpenStreetMap + Leaflet maps, OSRM routing, Nominatim geocoding, SQLite storage.

---

## Features

| Area | What's in it |
|---|---|
| **Auth** | Email/password signup & login for *patients* and *doctors*, bcrypt hashing, JWT in httpOnly cookie, 30-day sessions, profile editing |
| **Doctors** | Directory with specialties, MDCN numbers, fees, ratings, **live online presence** |
| **Booking** | 2-step wizard: symptom chips, free-text reason, duration, urgency → request lands in the doctor's queue in real time |
| **Doctor console** | Live waiting room, accept/decline, patient chart (age, blood group, allergies), queue by status |
| **Video call** | Peer-to-peer WebRTC (perfect-negotiation), STUN by default + optional TURN, mute/camera/flip, draggable PiP, connection-quality meter, call timer, screen wake-lock, ICE restart on failure |
| **Ringing** | Doctor starts the call → patient's device rings (banner, tone, vibration, system notification) |
| **In-call** | Persistent chat, patient info panel, doctor writes the care plan *during* the call |
| **Care plan** | Diagnosis, notes, advice, follow-up; prescriptions (drug/strength/dose/frequency/duration/qty); tests with urgency; quick-add for common Nigerian formulary items & tests |
| **Verification** | Every plan gets a code (`NC-XXXXXX`) + QR. Public `/verify/<code>` page for pharmacists & lab scientists |
| **Facilities** | 36 real Enugu facilities (16 MLSCN labs, 20 PCN pharmacies) with services, hours, phone; sorted by **distance from you**; filtered by **tests in your plan** (e.g. "labs that run Malaria Parasite + FBC") |
| **Directions** | Driving & walking routes with step-by-step instructions drawn on the map; Google Maps deep link; tap-to-call |
| **PWA** | Installable (manifest, icons, shortcuts), service worker with app-shell caching, offline read of care plans/facilities, map-tile cache, notification click routing, offline banner |
| **Realtime** | WebSocket: presence, appointment updates, plan updates, chat, ring, WebRTC signaling |
| **Web Push** | VAPID push notifications — the patient's phone rings and gets updates **even with the app closed** (keys auto-generated) |
| **Payments** | Paystack inline checkout (card/transfer/USSD) gates the call; server-side verify + signed webhook. Demo mode when no keys set |
| **Free-tier persistence** | `persist.js` snapshots the SQLite DB to Turso (free) after every write and restores on boot — survives disk-less hosts like Render Free |
| **Split hosting** | Frontend can live on Netlify/Vercel/Cloudflare Pages; backend anywhere. Set `window.NC_API`; CORS + bearer-token auth built in |
| **Security** | bcrypt, httpOnly JWT cookie, rate-limited auth, security headers, HTTPS redirect, room-level authorization on signaling |
| **Ratings** | Patients rate completed consultations; averages appear on doctor cards |

## Quick start

```bash
npm install
npm start          # → http://localhost:3000
```

Demo accounts (seeded on first run):

| Role | Email | Password |
|---|---|---|
| Patient | `ada@demo.ng` | `patient123` |
| Doctor (GP) | `adaeze@nducare.ng` | `doctor123` |
| Doctor (Paeds) | `ngozi@nducare.ng` | `doctor123` |
| Others | `emeka@`, `ifeanyi@`, `chioma@`, `obinna@nducare.ng` | `doctor123` |

**To test a video call:** open the patient in one browser and the doctor in another (or a phone on the
same Wi-Fi). Patient books → doctor accepts → doctor clicks *Start video call* → patient's screen rings.

> Camera/mic require a secure context: `localhost` is fine; on a LAN IP or domain you need **HTTPS**.

## Tests

```bash
node scripts/e2e.test.js        # REST + WebSocket flow (server must be running)
pip install playwright && playwright install chromium
python3 scripts/ui.test.py      # full browser flow incl. a real 2-peer WebRTC call
```

## Deploying to your own domain

**→ [EASY.md](EASY.md)** — **simplest**: no terminal, drag‑and‑drop upload, all free  
**→ [FREE.md](FREE.md)** — **$0 hosting**: Netlify + Render Free + Turso snapshot persistence + cron ping  
**→ [NO-DOMAIN.md](NO-DOMAIN.md)** — **start here if you don't own a domain yet** (free Netlify + Fly URLs)  
**→ [NETLIFY.md](NETLIFY.md)** — Netlify frontend (free) + cheapest backend (Oracle Free / Hetzner / Fly)  
**→ [DEPLOY.md](DEPLOY.md)** — single-host options (Render / Fly / VPS)

Summary:

The app is a single Node process (Express + WebSocket) with a SQLite file. It needs:
1. Node ≥ 20
2. A **persistent disk** for `DB_PATH`
3. **HTTPS** (mandatory for camera/mic and PWA install) — every option below gives you this for free
4. `JWT_SECRET` set to a long random string

### Option A — Render (easiest, ~5 min)
1. Push this folder to a GitHub repo.
2. Render → *New → Blueprint* → select the repo. `render.yaml` provisions the web service + 1 GB disk.
3. Add your domain under *Settings → Custom Domains* and point a CNAME at it. TLS is automatic.

### Option B — Fly.io (closest region to Nigeria: `jnb` Johannesburg)
```bash
fly launch --no-deploy --copy-config
fly volumes create nducare_data --size 1 --region jnb
fly secrets set JWT_SECRET=$(openssl rand -hex 32)
fly deploy
fly certs add yourdomain.com
```

### Option C — Any VPS (DigitalOcean, Hetzner, Contabo…) with Docker
```bash
docker build -t nducare .
docker run -d --name nducare -p 3000:3000 -v nducare_data:/data \
  -e JWT_SECRET=$(openssl rand -hex 32) --restart unless-stopped nducare
```
Then put **Caddy** in front for automatic HTTPS + WebSocket proxying:
```
yourdomain.com {
    reverse_proxy localhost:3000
}
```

### Option D — Railway
New project → Deploy from GitHub → add a *Volume* mounted at `/data` → set `DB_PATH=/data/nducare.db`
and `JWT_SECRET`. Attach your domain in *Settings → Networking*.

### TURN server (recommended for production video)
Peer-to-peer WebRTC succeeds directly for most users, but ~10–20 % of connections (strict mobile
carrier NATs, e.g. some MTN/Airtel configurations) need a TURN relay. Add one in `public/config.js`:

```js
window.NC_TURN = { urls: 'turn:turn.yourdomain.com:3478', username: 'nducare', credential: '…' };
```
Free/cheap options: [Metered.ca](https://www.metered.ca/tools/openrelay/) (free tier),
Twilio Network Traversal, or self-host **coturn** on the same VPS.

## Project structure

```
server.js            Express API + WebSocket (presence, signaling, chat, notifications)
db.js                SQLite schema + seed (doctors, demo patient, facilities)
data/facilities.json 36 geocoded Enugu labs & pharmacies (regenerate: npm run seed:facilities)
public/
  index.html, manifest.webmanifest, sw.js, config.js
  css/app.css        design system
  js/core.js         state, api, router, websocket, helpers, icons
  js/layout.js       app shell (sidebar / bottom nav)
  js/pages/          public (landing, auth, verify), patient, doctor, call, map
scripts/             geocoder, REST/WS e2e test, Playwright UI test
```

## API overview

```
POST /api/auth/signup | login | logout        GET/PATCH /api/auth/me
GET  /api/doctors  /api/specialties
POST /api/appointments                        GET /api/appointments[/:id]
POST /api/appointments/:id/status             PUT /api/appointments/:id/plan
POST /api/appointments/:id/review             GET /api/rooms/:room/messages
GET  /api/verify/:code   (public)             GET /api/qr?text=
GET  /api/facilities?type&lat&lng&q&service   GET /api/facilities/:id
GET  /api/route?from=lat,lng&to=lat,lng&mode  GET /api/geocode?q=
GET  /api/stats
WS   /ws   join | leave | offer | answer | ice | media-state | hangup | chat | ring
```

## Roadmap / production hardening
- MDCN register lookup on doctor signup; admin approval queue
- Postgres instead of SQLite for multi-instance scaling; Redis for WS fan-out
- Lab result upload & pharmacy order fulfilment (facilities get their own logins)
- E-prescription signing (PKI) and NHIA/HMO integration

## Notes
- Facility data was compiled from public directories and geocoded with Nominatim; verify accreditation status with MLSCN/PCN before production use.
- This is not a substitute for emergency care. In an emergency call **112**.
