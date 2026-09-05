# Hosting NduCare: Netlify (frontend, free) + cheap backend

## The honest part first
Netlify hosts **static files and short-lived serverless functions**. NduCare's backend needs two things
Netlify can't do: **persistent WebSockets** (doctor presence, ringing, video signaling) and a **disk for the
database**. So the setup is:

```
 Browser ──HTTPS──▶ Netlify  (index.html, JS, CSS, icons, service worker)   $0
    │
    └──HTTPS/WSS──▶ Backend  (server.js: API + WebSocket + SQLite)          $0–5/mo
```
The code already supports this split: set `window.NC_API` in `public/config.js` and the frontend talks to
the remote API with a bearer token instead of cookies.

---

## Cheapest backend options, ranked (Sept 2026)

| # | Host | Price | Always on? | Verdict for NduCare |
|---|---|---|---|---|
| 1 | **Oracle Cloud "Always Free" VM** | **$0 forever** | ✅ | Best free option. A real Linux VM (up to 4 ARM cores / 24 GB RAM, being reduced to 2/12 for new accounts; still huge for us) with 200 GB disk and 10 TB bandwidth. Needs a card for signup and getting an ARM instance can take retries; the tiny AMD micro instance (1 GB) is easier to get and is enough. |
| 2 | **Hetzner CX22 / Contabo / DigitalOcean** | **€3.8–$6/mo** | ✅ | Most reliable cheap option. Zero surprises. Use this if you'd rather pay ₦8k/mo than fight Oracle signup. |
| 3 | **Fly.io** | ~$2–3/mo (shared-cpu-1x 256 MB + 1 GB volume) | ✅ | Managed, Johannesburg region, WebSockets + volumes supported. |
| 4 | **Koyeb free** | $0 | ❌ sleeps after 1 h idle, no volume | Sleeping breaks presence/ringing and the SQLite file is wiped. Only for demos. |
| 5 | **Render free** | $0 | ❌ sleeps after 15 min, no disk | Same problem — database vanishes on spin-down. Render **Starter $7** is fine but not "cheaper". |

**Why "always on" matters:** if the backend sleeps, the doctor appears offline, the patient's phone never rings,
and with no persistent disk your SQLite database is erased. Free sleeping tiers are fine to *demo*; not to *treat people*.

**My recommendation:** Netlify + **Oracle Always Free** if you're comfortable with a terminal (≈30 min setup, $0/mo forever).
Otherwise Netlify + **Hetzner** (€3.79/mo) — same steps, no signup lottery.

---

## Step 1 — Backend on a VM (Oracle Free or Hetzner) — identical steps

1. Create the VM: **Ubuntu 24.04**, open ports **80 & 443** in the cloud firewall (Oracle: VCN → Security List → Ingress rules; Hetzner: Firewall).
2. Point DNS: **A record** `api.yourdomain.com` → the VM's public IP.
3. SSH in and run:
```bash
sudo apt update && sudo apt install -y git
curl -fsSL https://get.docker.com | sudo sh
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/gpg.key' | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf 'https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt' | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update && sudo apt install -y caddy

git clone https://github.com/<you>/nducare.git && cd nducare
sudo docker build -t nducare .
sudo docker run -d --name nducare --restart unless-stopped -p 127.0.0.1:3000:3000 \
  -v nducare_data:/data \
  -e JWT_SECRET=$(openssl rand -hex 32) \
  -e CORS_ORIGIN=https://nducare.netlify.app,https://app.yourdomain.com \
  -e FRONTEND_URL=https://app.yourdomain.com \
  -e VAPID_SUBJECT=mailto:you@yourdomain.com \
  nducare

# HTTPS + WebSocket proxy
echo 'api.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}' | sudo tee /etc/caddy/Caddyfile
sudo systemctl restart caddy
```
4. Oracle only: Ubuntu's own firewall also blocks ports — run
   `sudo iptables -I INPUT -p tcp --dport 80 -j ACCEPT && sudo iptables -I INPUT -p tcp --dport 443 -j ACCEPT && sudo netfilter-persistent save`
5. Test: `https://api.yourdomain.com/api/health` → `{"ok":true}`

> **Fly.io instead?** `fly launch --copy-config --no-deploy && fly volumes create nducare_data --size 1 --region jnb && fly secrets set JWT_SECRET=$(openssl rand -hex 32) CORS_ORIGIN=https://app.yourdomain.com FRONTEND_URL=https://app.yourdomain.com && fly deploy && fly certs add api.yourdomain.com`

---

## Step 2 — Frontend on Netlify (free)

1. Edit `public/config.js`:
   ```js
   window.NC_API = 'https://api.yourdomain.com';
   ```
   Commit & push.
2. **app.netlify.com → Add new site → Import from Git** → choose the repo.
   Netlify reads `netlify.toml` (publish dir `public`, SPA redirect, headers). Click **Deploy**.
3. **Custom domain:** Site → Domain management → add `app.yourdomain.com` → CNAME to your Netlify subdomain. HTTPS is automatic.
4. Make sure that exact origin is in the backend's `CORS_ORIGIN` list (Step 1). If you change it: `sudo docker rm -f nducare` and re-run the `docker run` line with the new value.

Open `https://app.yourdomain.com` → sign in as `adaeze@nducare.ng / doctor123` on one phone, sign up as a patient on another → video call.

---

## Step 3 — TURN (do it, it's free)
metered.ca → free TURN credentials → paste into `public/config.js` as `window.NC_TURN = {...}` → push. Netlify redeploys in ~20 s.

---

## Updating
- **Frontend:** `git push` → Netlify auto-deploys.
- **Backend:** on the VM: `cd nducare && git pull && sudo docker build -t nducare . && sudo docker rm -f nducare && <same docker run line>`
  (Or save the run line as `deploy.sh` once.)

## Backups
The whole database is one file inside the `nducare_data` volume:
`sudo docker cp nducare:/data/nducare.db ./backup-$(date +%F).db` — cron it weekly to your laptop or an S3 bucket.

## Cost summary
| Setup | Monthly |
|---|---|
| Netlify + Oracle Always Free | **$0** (+ domain ~$10/yr) |
| Netlify + Hetzner CX22 | **€3.79** |
| Netlify + Fly.io | ~$2–3 |
| Netlify + Render Starter | $7 |
