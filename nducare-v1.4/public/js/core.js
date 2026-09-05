// ---------- Core: state, api, ws, router, ui helpers ----------
export const state = { user: null, onlineDoctors: new Set(), ws: null, loc: null, ringing: null, installPrompt: null };
const listeners = new Set();
export const onState = fn => (listeners.add(fn), () => listeners.delete(fn));
export const emit = () => listeners.forEach(fn => fn(state));

// API base: same origin by default; set window.NC_API = 'https://api.yourdomain.com' in config.js for split hosting (e.g. Netlify + VPS)
// Zero-edit setup: ?api=https://your-api.onrender.com once → remembered in localStorage.
(() => { try { const q = new URLSearchParams(location.search).get('api'); if (q) { localStorage.setItem('nc_api', q.replace(/\/$/, '')); history.replaceState({}, '', location.pathname); } } catch { } })();
export const API_BASE = (window.NC_API || localStorage.getItem('nc_api') || '').replace(/\/$/, '');
export const apiUrl = path => API_BASE + '/api' + path;
const tokenKey = 'nc_token';
export const getToken = () => localStorage.getItem(tokenKey);
export const setToken = t => t ? localStorage.setItem(tokenKey, t) : localStorage.removeItem(tokenKey);
export async function api(path, opts = {}) {
  const headers = { 'Content-Type': 'application/json', ...(getToken() ? { Authorization: 'Bearer ' + getToken() } : {}) };
  const r = await fetch(apiUrl(path), { headers, credentials: API_BASE ? 'omit' : 'same-origin', ...opts, body: opts.body ? JSON.stringify(opts.body) : undefined });
  let j = {}; try { j = await r.json(); } catch { }
  if (!r.ok) { const e = new Error(j.error || r.statusText); e.status = r.status; e.data = j; throw e; }
  return j;
}

// ---------- icons ----------
export const I = {
  video: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m22 8-6 4 6 4V8Z"/><rect width="14" height="12" x="2" y="6" rx="2"/></svg>',
  videoOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.66 6H14a2 2 0 0 1 2 2v2.5l5.248-3.062A.5.5 0 0 1 22 7.87v8.196"/><path d="M16 16a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h2"/><path d="m2 2 20 20"/></svg>',
  mic: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  micOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="2" x2="22" y1="2" y2="22"/><path d="M18.89 13.23A7.12 7.12 0 0 0 19 12v-2"/><path d="M5 10v2a7 7 0 0 0 12 5"/><path d="M15 9.34V5a3 3 0 0 0-5.68-1.33"/><path d="M9 9v3a3 3 0 0 0 5.12 2.12"/><line x1="12" x2="12" y1="19" y2="22"/></svg>',
  phoneOff: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10.68 13.31a16 16 0 0 0 3.41 2.6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7 2 2 0 0 1 1.72 2v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.42 19.42 0 0 1-3.33-2.67m-2.67-3.34a19.79 19.79 0 0 1-3.07-8.63A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91"/><line x1="22" x2="2" y1="2" y2="22"/></svg>',
  phone: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"/></svg>',
  chat: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M7.9 20A9 9 0 1 0 4 16.1L2 22Z"/></svg>',
  home: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>',
  steth: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3"/><path d="M8 15v1a6 6 0 0 0 6 6a6 6 0 0 0 6-6v-4"/><circle cx="20" cy="10" r="2"/></svg>',
  cal: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="18" height="18" x="3" y="4" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/></svg>',
  map: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14.106 5.553a2 2 0 0 0 1.788 0l3.659-1.83A1 1 0 0 1 21 4.619v12.764a1 1 0 0 1-.553.894l-4.553 2.277a2 2 0 0 1-1.788 0l-4.212-2.106a2 2 0 0 0-1.788 0l-3.659 1.83A1 1 0 0 1 3 19.381V6.618a1 1 0 0 1 .553-.894l4.553-2.277a2 2 0 0 1 1.788 0z"/><path d="M15 5.764v15M9 3.236v15"/></svg>',
  user: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="8" r="5"/><path d="M20 21a8 8 0 0 0-16 0"/></svg>',
  pill: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m10.5 20.5 10-10a4.95 4.95 0 1 0-7-7l-10 10a4.95 4.95 0 1 0 7 7Z"/><path d="m8.5 8.5 7 7"/></svg>',
  flask: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 2v7.527a2 2 0 0 1-.211.896L4.72 20.55a1 1 0 0 0 .9 1.45h12.76a1 1 0 0 0 .9-1.45l-5.069-10.127A2 2 0 0 1 14 9.527V2"/><path d="M8.5 2h7M7 16h10"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/><circle cx="12" cy="10" r="3"/></svg>',
  nav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="3 11 22 2 13 21 11 13 3 11"/></svg>',
  check: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 6 9 17l-5-5"/></svg>',
  x: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>',
  back: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 19-7-7 7-7M19 12H5"/></svg>',
  shield: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"/><path d="m9 12 2 2 4-4"/></svg>',
  clock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>',
  star: '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/></svg>',
  print: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect width="12" height="8" x="6" y="14"/></svg>',
  logout: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" x2="9" y1="12" y2="12"/></svg>',
  plus: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M5 12h14M12 5v14"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  heart: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>',
  pulse: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg>',
  walk: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="13" cy="4" r="1.5"/><path d="m8 22 3-8 3 3v5M9 12l1.5-5L14 8l2 3 3 1"/><path d="m8.5 13-2 3L4 15"/></svg>',
  car: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.7-1.5-1.9C18.7 10.6 16 10 16 10s-1.3-1.4-2.2-2.3c-.5-.4-1.1-.7-1.8-.7H5c-.6 0-1.1.4-1.4.9l-1.4 2.9A3.7 3.7 0 0 0 2 12v4c0 .6.4 1 1 1h2"/><circle cx="7" cy="17" r="2"/><path d="M9 17h6"/><circle cx="17" cy="17" r="2"/></svg>',
  swap: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/><path d="m16 15 3-3-3-3"/><path d="m8 9-3 3 3 3"/></svg>',
  copy: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="14" x="8" y="8" rx="2"/><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2"/></svg>',
  info: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 16v-4M12 8h.01"/></svg>',
  search: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"/><path d="m21 21-4.3-4.3"/></svg>',
  locate: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3"/><circle cx="12" cy="12" r="8"/></svg>',
  download: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4M7 10l5 5 5-5M12 15V3"/></svg>',
  flip: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 19H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2h5"/><path d="M13 5h7a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2h-5"/><circle cx="12" cy="12" r="3"/></svg>',
  bell: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"/><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"/></svg>',
};

// ---------- ui ----------
export const $ = (s, r = document) => r.querySelector(s);
export const $$ = (s, r = document) => [...r.querySelectorAll(s)];
export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const initials = n => (n || '?').split(' ').filter(Boolean).slice(0, 2).map(x => x[0].toUpperCase()).join('');
export const avatar = (name, hue = 160, cls = '', online) => `<div class="avatar ${cls}" style="background:linear-gradient(135deg,hsl(${hue} 60% 55%),hsl(${(hue + 40) % 360} 60% 40%))">${initials(name)}${online !== undefined ? `<i class="badge-dot ${online ? 'on' : ''}"></i>` : ''}</div>`;
export const naira = n => '₦' + Number(n || 0).toLocaleString('en-NG');
export const fmtDate = ts => ts ? new Date(+ts).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' }) : '—';
export const fmtDateOnly = ts => ts ? new Date(+ts).toLocaleDateString('en-NG', { dateStyle: 'long' }) : '—';
export const ago = ts => { const s = (Date.now() - ts) / 1000; if (s < 60) return 'just now'; if (s < 3600) return `${~~(s / 60)}m ago`; if (s < 86400) return `${~~(s / 3600)}h ago`; return `${~~(s / 86400)}d ago`; };
export const age = dob => dob ? Math.floor((Date.now() - new Date(dob)) / 3.15576e10) : null;
export const km = m => m < 1000 ? `${Math.round(m)} m` : `${(m / 1000).toFixed(1)} km`;
export const mins = s => s < 60 ? '<1 min' : s < 3600 ? `${Math.round(s / 60)} min` : `${Math.floor(s / 3600)}h ${Math.round((s % 3600) / 60)}m`;
export const stars = r => r ? '★'.repeat(Math.round(r)) + '☆'.repeat(5 - Math.round(r)) : '';
export const statusLabel = s => ({ requested: 'Awaiting doctor', accepted: 'Accepted', in_call: 'Live', completed: 'Completed', declined: 'Declined', cancelled: 'Cancelled' }[s] || s);

export function toast(title, body = '', kind = '', onClick) {
  let box = $('.toasts'); if (!box) { box = document.createElement('div'); box.className = 'toasts'; document.body.appendChild(box); }
  const t = document.createElement('div'); t.className = `toast ${kind}`; t.innerHTML = `<div><b>${esc(title)}</b>${body ? `<span>${esc(body)}</span>` : ''}</div>`;
  t.onclick = () => { t.remove(); onClick && onClick(); }; box.appendChild(t); setTimeout(() => t.remove(), 6000);
  if (navigator.vibrate && kind !== 'err') navigator.vibrate(30);
}
export function modal(html, { onMount } = {}) {
  const bg = document.createElement('div'); bg.className = 'modal-bg'; bg.innerHTML = `<div class="modal">${html}</div>`;
  const close = () => bg.remove();
  bg.addEventListener('click', e => { if (e.target === bg) close(); });
  $$('[data-close]', bg).forEach(b => b.onclick = close);
  document.body.appendChild(bg); onMount && onMount(bg, close); return close;
}
export const confirmBox = (title, body, ok = 'Confirm', danger = false) => new Promise(res => modal(`<h2>${esc(title)}</h2><p class="muted mt">${esc(body)}</p><div class="row mt2" style="justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn ${danger ? 'danger' : ''}" id="ok">${esc(ok)}</button></div>`, { onMount: (bg, close) => { $('#ok', bg).onclick = () => { close(); res(true); }; bg.addEventListener('click', e => e.target === bg && res(false)); $('[data-close]', bg).addEventListener('click', () => res(false)); } }));

// ---------- router ----------
const routes = [];
export const route = (pattern, handler) => routes.push({ re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '/?$'), handler });
export const navigate = (path, replace = false) => { history[replace ? 'replaceState' : 'pushState']({}, '', path); render(); };
export let current = { path: '/', params: {}, query: new URLSearchParams() };
let unmount = null;
export async function render() {
  const path = location.pathname; const query = new URLSearchParams(location.search);
  for (const r of routes) {
    const m = path.match(r.re);
    if (m) {
      if (typeof unmount === 'function') { try { unmount(); } catch { } }
      unmount = null;
      current = { path, params: m.groups || {}, query };
      const out = await r.handler(current);
      if (typeof out === 'function') unmount = out;
      window.scrollTo(0, 0);
      return;
    }
  }
  navigate('/', true);
}
window.addEventListener('popstate', render);
document.addEventListener('click', e => {
  const a = e.target.closest('a[href]'); if (!a) return;
  const href = a.getAttribute('href');
  if (href.startsWith('/') && !a.target && !a.hasAttribute('download') && !href.startsWith('/api')) { e.preventDefault(); navigate(href); }
});

// ---------- websocket ----------
const wsHandlers = new Map();
export const onWS = (type, fn) => { if (!wsHandlers.has(type)) wsHandlers.set(type, new Set()); wsHandlers.get(type).add(fn); return () => wsHandlers.get(type).delete(fn); };
let wsRetry = 1000, wsWanted = false;
export function connectWS() {
  wsWanted = true;
  if (state.ws && state.ws.readyState <= 1) return;
  const base = API_BASE ? new URL(API_BASE) : location;
  const ws = new WebSocket(`${base.protocol === 'https:' ? 'wss' : 'ws'}://${base.host}/ws${getToken() ? '?token=' + encodeURIComponent(getToken()) : ''}`);
  state.ws = ws;
  ws.onopen = () => { wsRetry = 1000; emit(); (wsHandlers.get('open') || []).forEach(f => f()); };
  ws.onmessage = e => {
    let m; try { m = JSON.parse(e.data); } catch { return; }
    if (m.type === 'presence') { state.onlineDoctors = new Set(m.doctors); emit(); }
    (wsHandlers.get(m.type) || []).forEach(f => f(m));
    (wsHandlers.get('*') || []).forEach(f => f(m));
  };
  ws.onclose = () => { state.ws = null; emit(); if (wsWanted) setTimeout(connectWS, wsRetry = Math.min(wsRetry * 1.7, 15000)); };
}
export function disconnectWS() { wsWanted = false; state.ws?.close(); state.ws = null; }
export const send = m => { if (state.ws?.readyState === 1) state.ws.send(JSON.stringify(m)); };

// ---------- auth ----------
export async function loadMe() { try { const { user } = await api('/auth/me'); state.user = user; } catch { state.user = null; } emit(); return state.user; }
export async function logout() { try { await api('/auth/logout', { method: 'POST' }); } catch { } setToken(null); state.user = null; disconnectWS(); emit(); navigate('/'); }

// ---------- geolocation ----------
export function locate({ silent = false } = {}) {
  return new Promise(res => {
    if (!navigator.geolocation) return res(null);
    navigator.geolocation.getCurrentPosition(p => { state.loc = { lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy }; localStorage.setItem('nc_loc', JSON.stringify(state.loc)); emit(); res(state.loc); },
      err => { if (!silent) toast('Location unavailable', 'Using Enugu city centre. You can search for your address on the map.', 'err'); res(null); }, { enableHighAccuracy: true, timeout: 9000, maximumAge: 120000 });
  });
}
try { const saved = JSON.parse(localStorage.getItem('nc_loc')); if (saved?.lat) state.loc = saved; } catch { }
export const ENUGU = { lat: 6.4483, lng: 7.5139 };
export const userLoc = () => state.loc || ENUGU;

// ---------- notifications & web push ----------
export async function askNotify() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') await Notification.requestPermission();
  if (Notification.permission === 'granted') subscribePush().catch(() => { });
}
export async function subscribePush() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) return false;
  const reg = await navigator.serviceWorker.ready;
  let sub = await reg.pushManager.getSubscription();
  if (!sub) { const { key } = await api('/push/key'); sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: urlB64(key) }); }
  await api('/push/subscribe', { method: 'POST', body: { subscription: sub.toJSON() } });
  return true;
}
const urlB64 = b => { const p = '='.repeat((4 - b.length % 4) % 4); const r = atob((b + p).replace(/-/g, '+').replace(/_/g, '/')); return Uint8Array.from([...r].map(c => c.charCodeAt(0))); };
export function sysNotify(title, body, url) {
  if (document.visibilityState === 'visible') return;
  if ('Notification' in window && Notification.permission === 'granted') {
    navigator.serviceWorker?.ready.then(reg => reg.showNotification(title, { body, icon: '/icons/icon-192.png', badge: '/icons/badge.png', data: { url }, vibrate: [100, 50, 100] })).catch(() => new Notification(title, { body }));
  }
}
