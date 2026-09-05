
const express = require('express');
const http = require('http');
const path = require('path');
const crypto = require('crypto');
const cookieParser = require('cookie-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { WebSocketServer } = require('ws');
const QRCode = require('qrcode');
const webpush = require('web-push');
const persist = require('./persist');
const { open: openDb, DB_PATH } = require('./db');
let db; // opened in main() after optional remote restore
const fs = require('fs');

const PORT = process.env.PORT || 3000;
let JWT_SECRET = process.env.JWT_SECRET;
function initSecret() { if (JWT_SECRET) return; db.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)"); const row = db.prepare("SELECT v FROM kv WHERE k='jwt'").get(); if (row) JWT_SECRET = row.v; else { JWT_SECRET = crypto.randomBytes(32).toString('hex'); db.prepare("INSERT INTO kv (k,v) VALUES ('jwt',?)").run(JWT_SECRET); } }
const IS_PROD = process.env.NODE_ENV === 'production';


// ---- Web Push (VAPID). Keys auto-generate & persist next to the DB on first run; override via env. ----
let VAPID = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY };
function initVapid() { // keys live in the DB (survives restarts when persistence is on) unless given via env
  db.exec("CREATE TABLE IF NOT EXISTS kv (k TEXT PRIMARY KEY, v TEXT)");
  if (!VAPID.publicKey) { const row = db.prepare("SELECT v FROM kv WHERE k='vapid'").get(); if (row) VAPID = JSON.parse(row.v); else { VAPID = webpush.generateVAPIDKeys(); db.prepare("INSERT INTO kv (k,v) VALUES ('vapid',?)").run(JSON.stringify(VAPID)); } }
  webpush.setVapidDetails(process.env.VAPID_SUBJECT || 'mailto:admin@nducare.ng', VAPID.publicKey, VAPID.privateKey);
}

// ---- Paystack (optional). Without a secret key the app runs in demo mode (payments auto-succeed). ----
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY || '';
const PAYSTACK_PUBLIC = process.env.PAYSTACK_PUBLIC_KEY || '';
// Split hosting: comma-separated list of allowed frontend origins (e.g. https://nducare.netlify.app,https://app.yourdomain.com)
const CORS_ORIGINS = (process.env.CORS_ORIGIN || '').split(',').map(x => x.trim()).filter(Boolean);
let FRONTEND_URL = (process.env.FRONTEND_URL || CORS_ORIGINS[0] || '').replace(/\/$/, '');

const app = express();
app.set('trust proxy', 1);
app.use((req, res, next) => req.path === '/api/payments/webhook' ? next() : express.json({ limit: '1mb' })(req, res, next));
app.use(cookieParser());
app.use((req, res, next) => {
  const origin = req.headers.origin;
  const originOk = origin && (CORS_ORIGINS.includes(origin) || (!CORS_ORIGINS.length && /^https:\/\/[a-z0-9-]+\.(netlify\.app|pages\.dev|vercel\.app|github\.io)$/.test(origin)));
  if (originOk) {
    if (!process.env.FRONTEND_URL && !CORS_ORIGINS.length) FRONTEND_URL = origin; // learn the frontend URL automatically
    res.setHeader('Access-Control-Allow-Origin', origin); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,PUT,PATCH,DELETE,OPTIONS');
    res.setHeader('Access-Control-Max-Age', '86400');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
  }
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(self), microphone=(self), geolocation=(self)');
  if (IS_PROD && req.headers['x-forwarded-proto'] === 'http') return res.redirect(301, 'https://' + req.headers.host + req.url);
  next();
});
// simple in-memory rate limiter for auth & write endpoints
const hits = new Map();
const rateLimit = (max, windowMs) => (req, res, next) => {
  const k = (req.ip || 'x') + ':' + req.path; const now = Date.now(); const e = hits.get(k) || { n: 0, t: now };
  if (now - e.t > windowMs) { e.n = 0; e.t = now; } e.n++; hits.set(k, e);
  if (hits.size > 50000) hits.clear();
  if (e.n > max) return res.status(429).json({ error: 'Too many attempts. Please wait a minute and try again.' });
  next();
};
app.use('/api/auth/login', rateLimit(15, 60000));
app.use('/api/auth/signup', rateLimit(10, 60000));
app.use('/api/verify', rateLimit(60, 60000));

// ---------- helpers ----------
const now = () => Date.now();
const safeUser = u => u && ({ id: u.id, role: u.role, name: u.name, email: u.email, phone: u.phone, specialty: u.specialty, bio: u.bio, mdcn: u.mdcn, fee: u.fee, avatar_hue: u.avatar_hue, gender: u.gender, dob: u.dob, blood_group: u.blood_group, allergies: u.allergies, lat: u.lat, lng: u.lng, online: onlineUsers.has(u.id) });
const genCode = (n = 6) => { const a = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; return Array.from(crypto.randomBytes(n)).map(b => a[b % a.length]).join(''); };
const sign = u => jwt.sign({ id: u.id, role: u.role }, JWT_SECRET, { expiresIn: '30d' });
const setAuthCookie = (res, token) => res.cookie('nc_token', token, { httpOnly: true, sameSite: 'lax', secure: IS_PROD, maxAge: 30 * 864e5 });

function auth(required = true) {
  return (req, res, next) => {
    const bearer = (req.headers.authorization || '').replace(/^Bearer\s+/i, '').trim();
    const token = bearer || req.cookies.nc_token;
    if (!token) return required ? res.status(401).json({ error: 'Please sign in' }) : next();
    try {
      const p = jwt.verify(token, JWT_SECRET);
      req.user = db.prepare('SELECT * FROM users WHERE id=?').get(p.id);
      if (!req.user) throw new Error('gone');
      next();
    } catch { if (required) return res.status(401).json({ error: 'Session expired, please sign in' }); next(); }
  };
}
const requireRole = role => (req, res, next) => req.user.role === role ? next() : res.status(403).json({ error: `Only ${role}s can do this` });
const haversine = (a, b, c, d) => { const R = 6371, t = x => x * Math.PI / 180, dLat = t(c - a), dLon = t(d - b); const h = Math.sin(dLat / 2) ** 2 + Math.cos(t(a)) * Math.cos(t(c)) * Math.sin(dLon / 2) ** 2; return 2 * R * Math.asin(Math.sqrt(h)); };

function migrate() {
db.exec(`CREATE TABLE IF NOT EXISTS push_subs (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, endpoint TEXT NOT NULL UNIQUE, sub TEXT NOT NULL, created_at INTEGER DEFAULT (strftime('%s','now')*1000));
CREATE TABLE IF NOT EXISTS payments (id INTEGER PRIMARY KEY AUTOINCREMENT, appointment_id INTEGER NOT NULL, patient_id INTEGER NOT NULL, amount INTEGER NOT NULL, reference TEXT UNIQUE, status TEXT DEFAULT 'pending', provider TEXT, created_at INTEGER DEFAULT (strftime('%s','now')*1000));`);
try { db.exec("ALTER TABLE appointments ADD COLUMN paid INTEGER DEFAULT 0"); } catch { }
}

// ---- ICE servers (STUN/TURN) for video calls. TURN is required on mobile/carrier-grade NAT.
const STUN = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
let iceCache = { at: 0, servers: null };
app.get('/api/ice', async (req, res) => {
  try {
    if (Date.now() - iceCache.at < 10 * 60e3 && iceCache.servers) return res.json({ iceServers: iceCache.servers });
    let servers = [...STUN];
    if (process.env.METERED_API_KEY && process.env.METERED_DOMAIN) {
      const r = await fetch(`https://${process.env.METERED_DOMAIN}/api/v1/turn/credentials?apiKey=${process.env.METERED_API_KEY}`);
      if (r.ok) servers = servers.concat(await r.json());
    } else if (process.env.TURN_URLS) {
      servers.push({ urls: process.env.TURN_URLS.split(',').map(u => u.trim()), username: process.env.TURN_USERNAME, credential: process.env.TURN_CREDENTIAL });
    } else {
      // Open Relay Project public TURN (best effort, no key)
      servers.push({ urls: ['turn:openrelay.metered.ca:80', 'turn:openrelay.metered.ca:443', 'turn:openrelay.metered.ca:443?transport=tcp', 'turns:openrelay.metered.ca:443?transport=tcp'], username: 'openrelayproject', credential: 'openrelayproject' });
    }
    iceCache = { at: Date.now(), servers };
    res.json({ iceServers: servers });
  } catch { res.json({ iceServers: STUN }); }
});

app.get('/api/health', (req, res) => res.json({ ok: true, ts: Date.now(), online: onlineUsers.size, facilities: db.prepare('SELECT COUNT(*) c FROM facilities').get().c, doctors: db.prepare("SELECT COUNT(*) c FROM users WHERE role='doctor'").get().c, uptime_s: Math.round(process.uptime()), persist: persist.status() }));

// ---------- push ----------
app.get('/api/push/key', (req, res) => res.json({ key: VAPID.publicKey }));
app.post('/api/push/subscribe', auth(), (req, res) => {
  const sub = req.body?.subscription; if (!sub?.endpoint) return res.status(400).json({ error: 'Bad subscription' });
  db.prepare('INSERT INTO push_subs (user_id,endpoint,sub) VALUES (?,?,?) ON CONFLICT(endpoint) DO UPDATE SET user_id=excluded.user_id, sub=excluded.sub').run(req.user.id, sub.endpoint, JSON.stringify(sub));
  res.json({ ok: true });
});
app.delete('/api/push/subscribe', auth(), (req, res) => { db.prepare('DELETE FROM push_subs WHERE user_id=? AND endpoint=?').run(req.user.id, req.body?.endpoint || ''); res.json({ ok: true }); });
async function pushTo(userId, payload) {
  const subs = db.prepare('SELECT * FROM push_subs WHERE user_id=?').all(userId);
  for (const s of subs) {
    try { await webpush.sendNotification(JSON.parse(s.sub), JSON.stringify(payload), { TTL: 60, urgency: payload.urgent ? 'high' : 'normal' }); }
    catch (e) { if (e.statusCode === 404 || e.statusCode === 410) db.prepare('DELETE FROM push_subs WHERE id=?').run(s.id); }
  }
}

// ---------- payments (Paystack) ----------
app.get('/api/payments/config', (req, res) => res.json({ provider: PAYSTACK_SECRET ? 'paystack' : 'demo', public_key: PAYSTACK_PUBLIC }));
app.post('/api/appointments/:id/pay/init', auth(), requireRole('patient'), async (req, res) => {
  const a = db.prepare(apptQuery + ' WHERE a.id=? AND a.patient_id=?').get(req.params.id, req.user.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  if (a.paid) return res.json({ paid: true });
  const amount = a.doctor_fee || 0; const reference = 'NC-' + a.id + '-' + genCode(8);
  if (!PAYSTACK_SECRET || amount === 0) { // demo mode
    db.prepare('INSERT INTO payments (appointment_id,patient_id,amount,reference,status,provider) VALUES (?,?,?,?,?,?)').run(a.id, req.user.id, amount, reference, 'success', 'demo');
    db.prepare('UPDATE appointments SET paid=1 WHERE id=?').run(a.id);
    return res.json({ paid: true, demo: true, reference });
  }
  try {
    const r = await fetch('https://api.paystack.co/transaction/initialize', { method: 'POST', headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET, 'Content-Type': 'application/json' }, body: JSON.stringify({ email: req.user.email, amount: amount * 100, reference, currency: 'NGN', callback_url: `${FRONTEND_URL || (req.protocol + '://' + req.get('host'))}/appointments/${a.id}?pay=verify&ref=${reference}`, metadata: { appointment_id: a.id, patient: req.user.name, doctor: a.doctor_name } }) });
    const j = await r.json(); if (!j.status) throw new Error(j.message || 'Paystack error');
    db.prepare('INSERT INTO payments (appointment_id,patient_id,amount,reference,status,provider) VALUES (?,?,?,?,?,?)').run(a.id, req.user.id, amount, reference, 'pending', 'paystack');
    res.json({ paid: false, authorization_url: j.data.authorization_url, access_code: j.data.access_code, reference, public_key: PAYSTACK_PUBLIC, amount, email: req.user.email });
  } catch (e) { res.status(502).json({ error: 'Could not start payment: ' + e.message }); }
});
app.post('/api/payments/verify', auth(), async (req, res) => {
  const { reference } = req.body || {}; const p = db.prepare('SELECT * FROM payments WHERE reference=?').get(reference);
  if (!p) return res.status(404).json({ error: 'Unknown reference' });
  if (p.status === 'success') return res.json({ paid: true });
  try {
    const r = await fetch('https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference), { headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET } });
    const j = await r.json();
    if (j.status && j.data.status === 'success' && j.data.amount >= p.amount * 100) { db.prepare("UPDATE payments SET status='success' WHERE id=?").run(p.id); db.prepare('UPDATE appointments SET paid=1 WHERE id=?').run(p.appointment_id); return res.json({ paid: true }); }
    res.json({ paid: false, status: j.data?.status });
  } catch (e) { res.status(502).json({ error: e.message }); }
});
app.post('/api/payments/webhook', express.raw({ type: '*/*' }), (req, res) => {
  if (!PAYSTACK_SECRET) return res.sendStatus(200);
  const sig = crypto.createHmac('sha512', PAYSTACK_SECRET).update(req.body).digest('hex');
  if (sig !== req.headers['x-paystack-signature']) return res.sendStatus(401);
  try { const ev = JSON.parse(req.body); if (ev.event === 'charge.success') { const p = db.prepare('SELECT * FROM payments WHERE reference=?').get(ev.data.reference); if (p) { db.prepare("UPDATE payments SET status='success' WHERE id=?").run(p.id); db.prepare('UPDATE appointments SET paid=1 WHERE id=?').run(p.appointment_id); notify(p.patient_id, { type: 'appointment:update', appointment: db.prepare(apptQuery + ' WHERE a.id=?').get(p.appointment_id), title: 'Payment confirmed', body: 'You can join the call once the doctor accepts.' }); } } } catch { }
  res.sendStatus(200);
});

// ---------- auth ----------
app.post('/api/auth/signup', (req, res) => {
  const { role = 'patient', name, email, phone, password, specialty, mdcn, bio, fee, gender, dob } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'Name, email and password are required' });
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters' });
  if (!['patient', 'doctor'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  if (role === 'doctor' && (!specialty || !mdcn)) return res.status(400).json({ error: 'Doctors must provide specialty and MDCN number' });
  const em = String(email).trim().toLowerCase();
  if (db.prepare('SELECT 1 FROM users WHERE email=?').get(em)) return res.status(409).json({ error: 'An account with this email already exists' });
  const info = db.prepare(`INSERT INTO users (role,name,email,phone,password_hash,specialty,bio,mdcn,fee,avatar_hue,gender,dob)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?)`).run(role, name.trim(), em, phone || null, bcrypt.hashSync(password, 10), specialty || null, bio || null, mdcn || null, Number(fee) || 0, Math.floor(Math.random() * 360), gender || null, dob || null);
  const u = db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
  setAuthCookie(res, sign(u));
  res.json({ user: safeUser(u), token: sign(u) });
});

app.post('/api/auth/login', (req, res) => {
  const { email, password } = req.body || {};
  const u = db.prepare('SELECT * FROM users WHERE email=?').get(String(email || '').trim().toLowerCase());
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) return res.status(401).json({ error: 'Incorrect email or password' });
  setAuthCookie(res, sign(u));
  res.json({ user: safeUser(u), token: sign(u) });
});
app.post('/api/auth/logout', (req, res) => { res.clearCookie('nc_token', { httpOnly: true, sameSite: 'lax', secure: IS_PROD }); res.clearCookie('nc_token', { httpOnly: true, sameSite: 'none', secure: true }); res.json({ ok: true }); });
app.get('/api/auth/me', auth(false), (req, res) => res.json({ user: safeUser(req.user) || null }));
app.patch('/api/auth/me', auth(), (req, res) => {
  const allowed = ['name', 'phone', 'bio', 'specialty', 'fee', 'gender', 'dob', 'blood_group', 'allergies', 'lat', 'lng'];
  const sets = [], vals = [];
  for (const k of allowed) if (k in req.body) { sets.push(`${k}=?`); vals.push(req.body[k]); }
  if (sets.length) db.prepare(`UPDATE users SET ${sets.join(',')} WHERE id=?`).run(...vals, req.user.id);
  res.json({ user: safeUser(db.prepare('SELECT * FROM users WHERE id=?').get(req.user.id)) });
});

// ---------- doctors ----------
app.get('/api/doctors', auth(false), (req, res) => {
  const rows = db.prepare(`SELECT u.*, (SELECT AVG(stars) FROM reviews r WHERE r.doctor_id=u.id) rating,
    (SELECT COUNT(*) FROM reviews r WHERE r.doctor_id=u.id) review_count,
    (SELECT COUNT(*) FROM appointments a WHERE a.doctor_id=u.id AND a.status='completed') consults
    FROM users u WHERE role='doctor' ORDER BY name`).all();
  res.json({ doctors: rows.map(r => ({ ...safeUser(r), rating: r.rating ? +r.rating.toFixed(1) : null, review_count: r.review_count, consults: r.consults })) });
});
app.get('/api/specialties', (req, res) => res.json({ specialties: db.prepare("SELECT DISTINCT specialty FROM users WHERE role='doctor' AND specialty IS NOT NULL").all().map(r => r.specialty) }));

// ---------- appointments ----------
const apptQuery = `SELECT a.*, p.name patient_name, p.avatar_hue patient_hue, p.dob patient_dob, p.gender patient_gender, p.blood_group patient_blood, p.allergies patient_allergies, p.phone patient_phone,
  d.name doctor_name, d.specialty doctor_specialty, d.avatar_hue doctor_hue, d.fee doctor_fee, d.mdcn doctor_mdcn,
  (SELECT code FROM care_plans c WHERE c.appointment_id=a.id) plan_code
  FROM appointments a JOIN users p ON p.id=a.patient_id JOIN users d ON d.id=a.doctor_id`;

app.post('/api/appointments', auth(), requireRole('patient'), (req, res) => {
  const { doctor_id, reason, symptoms, urgency = 'routine', scheduled_at } = req.body || {};
  const doc = db.prepare("SELECT * FROM users WHERE id=? AND role='doctor'").get(doctor_id);
  if (!doc) return res.status(404).json({ error: 'Doctor not found' });
  if (!reason || reason.trim().length < 3) return res.status(400).json({ error: 'Please describe your reason for the visit' });
  const open = db.prepare("SELECT id FROM appointments WHERE patient_id=? AND doctor_id=? AND status IN ('requested','accepted','in_call')").get(req.user.id, doctor_id);
  if (open) return res.status(409).json({ error: 'You already have an open consultation with this doctor', appointment_id: open.id });
  const room = genCode(8);
  const info = db.prepare(`INSERT INTO appointments (patient_id,doctor_id,reason,symptoms,urgency,room_code,scheduled_at) VALUES (?,?,?,?,?,?,?)`)
    .run(req.user.id, doctor_id, reason.trim(), JSON.stringify(symptoms || []), urgency, room, scheduled_at || null);
  const appt = db.prepare(apptQuery + ' WHERE a.id=?').get(info.lastInsertRowid);
  notify(doctor_id, { type: 'appointment:new', appointment: appt, title: 'New consultation request', body: `${req.user.name}: ${reason.slice(0, 80)}` });
  res.json({ appointment: appt });
});

app.get('/api/appointments', auth(), (req, res) => {
  const col = req.user.role === 'doctor' ? 'a.doctor_id' : 'a.patient_id';
  res.json({ appointments: db.prepare(apptQuery + ` WHERE ${col}=? ORDER BY CASE a.status WHEN 'in_call' THEN 0 WHEN 'accepted' THEN 1 WHEN 'requested' THEN 2 ELSE 3 END, a.created_at DESC`).all(req.user.id) });
});

app.get('/api/appointments/:id', auth(), (req, res) => {
  const a = db.prepare(apptQuery + ' WHERE a.id=?').get(req.params.id);
  if (!a || (a.patient_id !== req.user.id && a.doctor_id !== req.user.id)) return res.status(404).json({ error: 'Not found' });
  const plan = db.prepare('SELECT * FROM care_plans WHERE appointment_id=?').get(a.id);
  const messages = db.prepare('SELECT m.*, u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE room_code=? ORDER BY created_at').all(a.room_code);
  const review = db.prepare('SELECT * FROM reviews WHERE appointment_id=?').get(a.id);
  res.json({ appointment: a, plan: plan && { ...plan, tests: JSON.parse(plan.tests), prescriptions: JSON.parse(plan.prescriptions) }, messages, review });
});

app.post('/api/appointments/:id/status', auth(), (req, res) => {
  const a = db.prepare('SELECT * FROM appointments WHERE id=?').get(req.params.id);
  if (!a || (a.patient_id !== req.user.id && a.doctor_id !== req.user.id)) return res.status(404).json({ error: 'Not found' });
  const { status } = req.body;
  const allowed = req.user.role === 'doctor' ? ['accepted', 'in_call', 'completed', 'declined'] : ['cancelled', 'in_call'];
  if (!allowed.includes(status)) return res.status(403).json({ error: 'Not allowed' });
  const extra = status === 'in_call' ? ', started_at=COALESCE(started_at,?)' : status === 'completed' ? ', ended_at=?' : ', ended_at=ended_at';
  db.prepare(`UPDATE appointments SET status=? ${extra} WHERE id=?`).run(status, ...(extra.includes('?') ? [now()] : []), a.id);
  const appt = db.prepare(apptQuery + ' WHERE a.id=?').get(a.id);
  const other = req.user.id === a.patient_id ? a.doctor_id : a.patient_id;
  const titles = { accepted: 'Consultation accepted', in_call: 'Doctor is calling you', completed: 'Consultation completed', declined: 'Consultation declined', cancelled: 'Consultation cancelled' };
  notify(other, { type: 'appointment:update', appointment: appt, title: titles[status] || 'Update', body: `${req.user.name} — ${appt.reason.slice(0, 60)}` });
  res.json({ appointment: appt });
});

// ---------- care plans ----------
app.put('/api/appointments/:id/plan', auth(), requireRole('doctor'), (req, res) => {
  const a = db.prepare('SELECT * FROM appointments WHERE id=? AND doctor_id=?').get(req.params.id, req.user.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  const { diagnosis = '', notes = '', advice = '', tests = [], prescriptions = [], follow_up_days = null } = req.body || {};
  const existing = db.prepare('SELECT * FROM care_plans WHERE appointment_id=?').get(a.id);
  const code = existing?.code || ('NC-' + genCode(6));
  if (existing) db.prepare('UPDATE care_plans SET diagnosis=?,notes=?,advice=?,tests=?,prescriptions=?,follow_up_days=? WHERE id=?').run(diagnosis, notes, advice, JSON.stringify(tests), JSON.stringify(prescriptions), follow_up_days, existing.id);
  else db.prepare('INSERT INTO care_plans (appointment_id,diagnosis,notes,advice,tests,prescriptions,follow_up_days,code) VALUES (?,?,?,?,?,?,?,?)').run(a.id, diagnosis, notes, advice, JSON.stringify(tests), JSON.stringify(prescriptions), follow_up_days, code);
  const plan = db.prepare('SELECT * FROM care_plans WHERE appointment_id=?').get(a.id);
  notify(a.patient_id, { type: 'plan:update', appointment_id: a.id, title: 'Your care plan is ready', body: `${req.user.name} has updated your prescription & tests` });
  res.json({ plan: { ...plan, tests: JSON.parse(plan.tests), prescriptions: JSON.parse(plan.prescriptions) } });
});

// public verification for pharmacies / labs
app.get('/api/verify/:code', (req, res) => {
  const p = db.prepare(`SELECT c.*, a.created_at appt_at, d.name doctor_name, d.mdcn doctor_mdcn, d.specialty doctor_specialty, u.name patient_name, u.dob patient_dob, u.gender patient_gender
    FROM care_plans c JOIN appointments a ON a.id=c.appointment_id JOIN users d ON d.id=a.doctor_id JOIN users u ON u.id=a.patient_id WHERE c.code=?`).get(req.params.code.toUpperCase());
  if (!p) return res.status(404).json({ error: 'No prescription found for this code' });
  res.json({ plan: { ...p, tests: JSON.parse(p.tests), prescriptions: JSON.parse(p.prescriptions) } });
});
app.get('/api/qr', async (req, res) => {
  try { res.type('svg').send(await QRCode.toString(String(req.query.text || '').slice(0, 500), { type: 'svg', margin: 1, color: { dark: '#0b2a63', light: '#ffffff00' } })); }
  catch { res.status(400).end(); }
});

// ---------- reviews ----------
app.post('/api/appointments/:id/review', auth(), requireRole('patient'), (req, res) => {
  const a = db.prepare("SELECT * FROM appointments WHERE id=? AND patient_id=? AND status='completed'").get(req.params.id, req.user.id);
  if (!a) return res.status(404).json({ error: 'Not found' });
  const stars = Math.max(1, Math.min(5, Number(req.body.stars) || 5));
  db.prepare('INSERT OR REPLACE INTO reviews (appointment_id,doctor_id,patient_id,stars,comment) VALUES (?,?,?,?,?)').run(a.id, a.doctor_id, a.patient_id, stars, req.body.comment || '');
  res.json({ ok: true });
});

// ---------- messages ----------
app.get('/api/rooms/:room/messages', auth(), (req, res) => {
  const a = db.prepare('SELECT * FROM appointments WHERE room_code=?').get(req.params.room);
  if (!a || (a.patient_id !== req.user.id && a.doctor_id !== req.user.id)) return res.status(404).json({ error: 'Not found' });
  res.json({ messages: db.prepare('SELECT m.*, u.name sender_name FROM messages m JOIN users u ON u.id=m.sender_id WHERE room_code=? ORDER BY created_at').all(a.room_code) });
});

// ---------- facilities ----------
app.get('/api/facilities', (req, res) => {
  const { type, lat, lng, q, service, limit = 50 } = req.query;
  let rows = db.prepare('SELECT * FROM facilities' + (type ? ' WHERE type=?' : '')).all(...(type ? [type] : []));
  rows = rows.map(r => ({ ...r, services: JSON.parse(r.services) }));
  if (q) { const s = q.toLowerCase(); rows = rows.filter(r => r.name.toLowerCase().includes(s) || (r.area || '').toLowerCase().includes(s) || (r.address || '').toLowerCase().includes(s)); }
  if (service) { const wanted = String(service).split('|').map(x => x.toLowerCase()); rows = rows.map(r => ({ ...r, matches: wanted.filter(w => r.services.some(s => s.toLowerCase().includes(w) || w.includes(s.toLowerCase()))).length })); }
  if (lat && lng) {
    rows = rows.map(r => ({ ...r, distance_km: +haversine(+lat, +lng, r.lat, r.lng).toFixed(2) }));
    rows.sort((a, b) => ((b.matches || 0) - (a.matches || 0)) || (a.distance_km - b.distance_km));
  } else rows.sort((a, b) => ((b.matches || 0) - (a.matches || 0)) || (b.rating - a.rating));
  res.json({ facilities: rows.slice(0, +limit) });
});
app.get('/api/facilities/:id', (req, res) => {
  const r = db.prepare('SELECT * FROM facilities WHERE id=?').get(req.params.id);
  if (!r) return res.status(404).json({ error: 'Not found' });
  res.json({ facility: { ...r, services: JSON.parse(r.services) } });
});

// ---------- routing proxy (OSRM) with tiny cache ----------
const routeCache = new Map();
app.get('/api/route', async (req, res) => {
  const { from, to, mode = 'driving' } = req.query; // "lat,lng"
  if (!from || !to) return res.status(400).json({ error: 'from & to required' });
  const [fl, fg] = from.split(',').map(Number), [tl, tg] = to.split(',').map(Number);
  const profile = mode === 'walking' ? 'foot' : 'driving';
  const key = `${profile}:${fl.toFixed(4)},${fg.toFixed(4)}>${tl.toFixed(4)},${tg.toFixed(4)}`;
  if (routeCache.has(key)) return res.json(routeCache.get(key));
  try {
    const url = `https://router.project-osrm.org/route/v1/${profile}/${fg},${fl};${tg},${tl}?overview=full&geometries=geojson&steps=true`;
    const r = await fetch(url, { headers: { 'User-Agent': 'NduCare/1.0' }, signal: AbortSignal.timeout(12000) });
    const j = await r.json();
    if (j.code !== 'Ok' || !j.routes?.[0]) throw new Error(j.message || 'No route');
    const rt = j.routes[0];
    const out = {
      distance_m: rt.distance, duration_s: rt.duration,
      coords: rt.geometry.coordinates.map(([x, y]) => [y, x]),
      steps: rt.legs[0].steps.map(s => ({ instruction: humanStep(s), distance_m: s.distance, name: s.name, type: s.maneuver.type, modifier: s.maneuver.modifier, loc: [s.maneuver.location[1], s.maneuver.location[0]] }))
    };
    routeCache.set(key, out); if (routeCache.size > 500) routeCache.delete(routeCache.keys().next().value);
    res.json(out);
  } catch (e) {
    // graceful fallback: straight line
    res.json({ distance_m: haversine(fl, fg, tl, tg) * 1000 * 1.3, duration_s: haversine(fl, fg, tl, tg) * 1000 * 1.3 / 8.3, coords: [[fl, fg], [tl, tg]], steps: [{ instruction: 'Head towards destination (offline estimate — live routing unavailable)', distance_m: haversine(fl, fg, tl, tg) * 1000 * 1.3 }], fallback: true });
  }
});
function humanStep(s) {
  const m = s.maneuver, name = s.name ? ` onto ${s.name}` : '';
  const mod = (m.modifier || '').replace('slight ', 'slightly ').replace('sharp ', 'sharply ').replace('uturn', 'around (U-turn)');
  if ((m.modifier || '') === 'uturn' && m.type !== 'depart') return `Make a U-turn${name}`;
  switch (m.type) {
    case 'depart': return `Head ${mod ? mod + ' ' : ''}${s.name ? 'on ' + s.name : 'out'}`;
    case 'arrive': return `Arrive at your destination${m.modifier ? ' on the ' + m.modifier : ''}`;
    case 'turn': return `Turn ${mod}${name}`;
    case 'new name': case 'continue': return `Continue ${mod && mod !== 'straight' ? mod + ' ' : ''}${s.name ? 'on ' + s.name : ''}`.trim();
    case 'roundabout': case 'rotary': return `At the roundabout, take exit ${m.exit || ''}${name}`;
    case 'merge': return `Merge ${mod}${name}`;
    case 'fork': return `Keep ${mod}${name}`;
    case 'end of road': return `At the end of the road turn ${mod}${name}`;
    case 'on ramp': case 'off ramp': return `Take the ramp ${mod}${name}`;
    default: return `${m.type[0].toUpperCase() + m.type.slice(1)} ${mod}${name}`.trim();
  }
}
// geocoding proxy (Nominatim requires UA)
app.get('/api/geocode', async (req, res) => {
  try {
    const r = await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=5&countrycodes=ng&q=' + encodeURIComponent(req.query.q || ''), { headers: { 'User-Agent': 'NduCare/1.0' }, signal: AbortSignal.timeout(8000) });
    res.json({ results: (await r.json()).map(x => ({ name: x.display_name, lat: +x.lat, lng: +x.lon })) });
  } catch { res.json({ results: [] }); }
});

// ---------- stats for dashboards ----------
app.get('/api/stats', auth(), (req, res) => {
  if (req.user.role === 'doctor') {
    const s = db.prepare(`SELECT SUM(status='requested') pending, SUM(status='completed') completed, SUM(status='completed' AND ended_at > ?) today FROM appointments WHERE doctor_id=?`).get(now() - 864e5, req.user.id);
    const rating = db.prepare('SELECT AVG(stars) r, COUNT(*) c FROM reviews WHERE doctor_id=?').get(req.user.id);
    return res.json({ ...s, rating: rating.r ? +rating.r.toFixed(1) : null, reviews: rating.c, online_doctors: [...onlineUsers.keys()].filter(id => db.prepare("SELECT role FROM users WHERE id=?").get(id)?.role === 'doctor').length });
  }
  const s = db.prepare(`SELECT SUM(status IN ('requested','accepted','in_call')) open, SUM(status='completed') completed FROM appointments WHERE patient_id=?`).get(req.user.id);
  const plans = db.prepare(`SELECT c.* FROM care_plans c JOIN appointments a ON a.id=c.appointment_id WHERE a.patient_id=? ORDER BY c.created_at DESC LIMIT 1`).get(req.user.id);
  res.json({ ...s, latest_plan: plans && { ...plans, tests: JSON.parse(plans.tests), prescriptions: JSON.parse(plans.prescriptions) }, online_doctors: db.prepare("SELECT id FROM users WHERE role='doctor'").all().filter(d => onlineUsers.has(d.id)).length });
});

// ---------- static / PWA ----------
app.use('/vendor/leaflet', express.static(path.join(__dirname, 'node_modules/leaflet/dist'), { maxAge: '30d' }));
app.use(express.static(path.join(__dirname, 'public'), { extensions: ['html'], setHeaders: (res, p) => { if (p.endsWith('sw.js')) res.setHeader('Cache-Control', 'no-cache'); } }));
app.get(/^\/(?!api|vendor).*/, (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

// ---------- WebSocket: presence, signaling, chat, notifications ----------
const server = http.createServer(app);
const wss = new WebSocketServer({ server, path: '/ws' });
const onlineUsers = new Map(); // userId -> Set<ws>
const rooms = new Map(); // room -> Set<ws>

function notify(userId, payload) {
  const set = onlineUsers.get(userId);
  const msg = JSON.stringify(payload);
  if (set) for (const ws of set) if (ws.readyState === 1) ws.send(msg);
  if (payload.title) {
    const url = payload.type === 'ring' ? '/call/' + payload.appointment.room_code : payload.appointment ? '/appointments/' + payload.appointment.id : payload.appointment_id ? '/appointments/' + payload.appointment_id : '/dashboard';
    pushTo(userId, { title: payload.title, body: payload.body || '', url: FRONTEND_URL + url, tag: payload.type, urgent: payload.type === 'ring' }).catch(() => { });
  }
}
function broadcastPresence() {
  const doctors = db.prepare("SELECT id FROM users WHERE role='doctor'").all().map(d => d.id).filter(id => onlineUsers.has(id));
  const msg = JSON.stringify({ type: 'presence', doctors });
  for (const ws of wss.clients) if (ws.readyState === 1) ws.send(msg);
}
function roomPeers(room) { return [...(rooms.get(room) || [])]; }

wss.on('connection', (ws, req) => {
  // auth from cookie
  const cookie = Object.fromEntries((req.headers.cookie || '').split(';').map(c => c.trim().split('=').map(decodeURIComponent)).filter(x => x[0]));
  const url = new URL(req.url, 'http://x');
  const token = url.searchParams.get('token') || cookie.nc_token;
  let user = null;
  try { user = db.prepare('SELECT * FROM users WHERE id=?').get(jwt.verify(token, JWT_SECRET).id); } catch { }
  if (!user) { ws.close(4001, 'unauthorized'); return; }
  ws.user = user; ws.isAlive = true;
  if (!onlineUsers.has(user.id)) onlineUsers.set(user.id, new Set());
  onlineUsers.get(user.id).add(ws);
  db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(), user.id);
  broadcastPresence();

  ws.on('pong', () => ws.isAlive = true);
  ws.on('message', raw => {
    let m; try { m = JSON.parse(raw); } catch { return; }
    if (m.type === 'join') {
      const a = db.prepare('SELECT * FROM appointments WHERE room_code=?').get(m.room);
      if (!a || (a.patient_id !== user.id && a.doctor_id !== user.id)) return ws.send(JSON.stringify({ type: 'error', error: 'Not allowed in this room' }));
      if (ws.room) leaveRoom(ws);
      ws.room = m.room;
      if (!rooms.has(m.room)) rooms.set(m.room, new Set());
      const peers = roomPeers(m.room).filter(p => p !== ws && p.user.id !== user.id);
      rooms.get(m.room).add(ws);
      ws.send(JSON.stringify({ type: 'joined', room: m.room, peers: peers.map(p => ({ id: p.user.id, name: p.user.name, role: p.user.role })), polite: peers.length > 0 }));
      for (const p of peers) p.send(JSON.stringify({ type: 'peer-joined', peer: { id: user.id, name: user.name, role: user.role } }));
      return;
    }
    if (m.type === 'leave') return leaveRoom(ws);
    if (['offer', 'answer', 'ice', 'media-state', 'hangup', 'vitals'].includes(m.type)) {
      for (const p of roomPeers(ws.room)) if (p !== ws && p.user.id !== user.id) p.send(JSON.stringify({ ...m, from: user.id }));
      return;
    }
    if (m.type === 'chat') {
      const a = db.prepare('SELECT * FROM appointments WHERE room_code=?').get(m.room);
      if (!a || (a.patient_id !== user.id && a.doctor_id !== user.id)) return;
      const body = String(m.body || '').slice(0, 2000); if (!body.trim()) return;
      const info = db.prepare('INSERT INTO messages (room_code,sender_id,body) VALUES (?,?,?)').run(m.room, user.id, body);
      const msg = { type: 'chat', room: m.room, id: info.lastInsertRowid, sender_id: user.id, sender_name: user.name, body, created_at: now() };
      const other = a.patient_id === user.id ? a.doctor_id : a.patient_id;
      notify(user.id, msg); notify(other, { ...msg, title: `Message from ${user.name}` });
      return;
    }
    if (m.type === 'ring') { // patient/doctor wants to start call — ping other party
      const a = db.prepare(apptQuery + ' WHERE a.room_code=?').get(m.room);
      if (!a) return;
      const other = a.patient_id === user.id ? a.doctor_id : a.patient_id;
      notify(other, { type: 'ring', appointment: a, from: { id: user.id, name: user.name, role: user.role }, title: `${user.name} is calling`, body: a.reason });
    }
  });
  ws.on('close', () => {
    leaveRoom(ws);
    const set = onlineUsers.get(user.id); if (set) { set.delete(ws); if (!set.size) onlineUsers.delete(user.id); }
    db.prepare('UPDATE users SET last_seen=? WHERE id=?').run(now(), user.id);
    broadcastPresence();
  });
});
function leaveRoom(ws) {
  if (!ws.room) return;
  const set = rooms.get(ws.room);
  if (set) { set.delete(ws); for (const p of set) p.send(JSON.stringify({ type: 'peer-left', peer: { id: ws.user.id, name: ws.user.name } })); if (!set.size) rooms.delete(ws.room); }
  ws.room = null;
}
setInterval(() => { for (const ws of wss.clients) { if (!ws.isAlive) return ws.terminate(); ws.isAlive = false; ws.ping(); } }, 30000);

async function main() {
  await persist.restore(DB_PATH);
  db = openDb();
  migrate(); initSecret(); initVapid();
  persist.attach(db);
  server.listen(PORT, '0.0.0.0', () => console.log(`NduCare running on http://0.0.0.0:${PORT}`));
  // Optional self keep-alive for free hosts that sleep (Render Free): set KEEPALIVE_URL=https://your-api.onrender.com/api/health
  const keep = process.env.KEEPALIVE_URL || (process.env.RENDER_EXTERNAL_URL ? process.env.RENDER_EXTERNAL_URL + '/api/health' : '');
  if (keep) setInterval(() => fetch(keep).catch(() => { }), 10 * 60 * 1000).unref();
}
main().catch(e => { console.error('Fatal startup error', e); process.exit(1); });
