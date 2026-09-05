# Deploy NduCare to your domain — step by step

Pick **one** path. All three give you HTTPS automatically (required for camera, mic, push and PWA install).

---

## ⭐ Recommended: Render (no server admin, ~10 minutes, from $7/mo)

1. **Put the code on GitHub**
   ```bash
   cd nducare
   git init && git add -A && git commit -m "NduCare v1"
   # create an empty repo on github.com, then:
   git remote add origin https://github.com/<you>/nducare.git
   git push -u origin main
   ```
2. Go to **render.com → New + → Blueprint**, pick the repo. Render reads `render.yaml` and creates:
   - a Node web service (`node server.js`)
   - a 1 GB persistent disk mounted at `/var/data` (your database lives there)
   - a random `JWT_SECRET`
3. When asked for env vars: set `VAPID_SUBJECT` to `mailto:you@yourdomain.com`. Leave Paystack blank for now.
4. Click **Apply**. In ~3 minutes you get `https://nducare-xxxx.onrender.com`. Test it.
5. **Custom domain:** Service → Settings → Custom Domains → Add `app.yourdomain.com`.
   At your DNS provider add a **CNAME** `app` → `nducare-xxxx.onrender.com`. Render issues the TLS certificate automatically.
6. Done. Log in as `adaeze@nducare.ng / doctor123` on one phone and sign up as a patient on another to test a real call.

> Use the **Starter** plan (not Free) — Free instances sleep after 15 min, which kills WebSocket presence and ringing.

---

## Option B: Fly.io (Johannesburg region, lowest latency to Nigeria)

```bash
curl -L https://fly.io/install.sh | sh
fly auth signup
cd nducare
fly launch --copy-config --no-deploy          # accepts fly.toml, app name "nducare"
fly volumes create nducare_data --size 1 --region jnb
fly secrets set JWT_SECRET=$(openssl rand -hex 32) VAPID_SUBJECT=mailto:you@yourdomain.com
fly deploy
fly certs add app.yourdomain.com              # then add the CNAME/A records it prints
```

---

## Option C: Your own VPS (Hetzner / DigitalOcean / Contabo, ~$5/mo, full control)

```bash
# on a fresh Ubuntu 24.04 server
curl -fsSL https://get.docker.com | sh
apt install -y caddy
git clone https://github.com/<you>/nducare.git && cd nducare
docker build -t nducare .
docker run -d --name nducare --restart unless-stopped -p 127.0.0.1:3000:3000 \
  -v nducare_data:/data \
  -e JWT_SECRET=$(openssl rand -hex 32) -e VAPID_SUBJECT=mailto:you@yourdomain.com nducare

# HTTPS reverse proxy (WebSockets work out of the box)
cat > /etc/caddy/Caddyfile <<CADDY
app.yourdomain.com {
    reverse_proxy 127.0.0.1:3000
}
CADDY
systemctl restart caddy
```
Point an **A record** `app` → your server IP. Caddy fetches the certificate automatically.

---

## After it's live — 3 things to switch on

### 1. TURN server (do this — it's what makes video work on MTN/Airtel/Glo data)
Peer-to-peer connects directly most of the time, but carrier-grade NAT on Nigerian mobile networks blocks it for a meaningful share of users. A TURN relay fixes that.

- Free & quickest: **metered.ca** → sign up → *TURN server* → copy credentials.
- Edit `public/config.js`:
  ```js
  window.NC_TURN = { urls: ['turn:a.relay.metered.ca:80', 'turn:a.relay.metered.ca:443?transport=tcp'], username: '...', credential: '...' };
  ```
- Redeploy. (Or self-host `coturn` on the VPS later.)

### 2. Paystack (real payments)
- dashboard.paystack.com → Settings → API Keys. Add `PAYSTACK_SECRET_KEY` and `PAYSTACK_PUBLIC_KEY` to your host's env vars.
- Settings → Webhooks → URL: `https://app.yourdomain.com/api/payments/webhook`
- Restart. Booking now opens the Paystack card/transfer/USSD popup; the call unlocks only after payment is confirmed (verified server-side + webhook).

### 3. Real doctors
- Delete demo accounts once you have real ones: `DELETE FROM users WHERE email LIKE '%@nducare.ng' OR email='ada@demo.ng';`
  (`sqlite3 /var/data/nducare.db` on the server, or via Render's shell.)
- Doctors sign up at `/signup?role=doctor` with their MDCN number. Verify them against mdcn.gov.ng before you promote the link publicly.

---

## Operations cheatsheet

| Task | How |
|---|---|
| Logs | Render dashboard → Logs · `fly logs` · `docker logs -f nducare` |
| Backup DB | copy `nducare.db` from the disk (it's a single file). Render: Shell → `cp /var/data/nducare.db /tmp && …` |
| Update app | `git push` (Render/Fly auto-deploy) · VPS: `git pull && docker build -t nducare . && docker rm -f nducare && docker run …` |
| Re-geocode facilities / add cities | edit `scripts/geocode.js`, run `npm run seed:facilities`, delete `facilities` rows or the DB, restart |
| Reset everything | delete `nducare.db` on the disk; it reseeds on restart |

## Cost estimate
- Render Starter **$7/mo** (or Fly ~$3–5, VPS ~$5) · Domain ~$10/yr · TURN free tier (metered: 0.5 GB/mo) → upgrade ~$0.40/GB when you grow · Paystack 1.5% + ₦100 per transaction.
