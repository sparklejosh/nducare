import { state, I, $, esc, avatar, toast, sysNotify, loadMe, connectWS, render, navigate, onWS, onState, askNotify, subscribePush } from './core.js';
import './pages/public.js';
import './pages/patient.js';
import './pages/doctor.js';
import './pages/call.js';
import './pages/map.js';

// ---------- global realtime notifications ----------
onWS('appointment:new', m => { toast(m.title, m.body, 'ok', () => navigate('/appointments/' + m.appointment.id)); sysNotify(m.title, m.body, '/appointments/' + m.appointment.id); });
onWS('appointment:update', m => { toast(m.title, m.body, m.appointment.status === 'declined' ? 'err' : 'ok', () => navigate('/appointments/' + m.appointment.id)); sysNotify(m.title, m.body, '/appointments/' + m.appointment.id); });
onWS('plan:update', m => { toast(m.title, m.body, 'ok', () => navigate('/appointments/' + m.appointment_id)); sysNotify(m.title, m.body, '/appointments/' + m.appointment_id); });
onWS('chat', m => { if (!location.pathname.startsWith('/call/') && m.sender_id !== state.user?.id) toast(m.title || 'New message', m.body, ''); });
onWS('ring', m => {
  if (location.pathname === '/call/' + m.appointment.room_code) return;
  sysNotify(m.title, m.body, '/call/' + m.appointment.room_code);
  let el = $('#ring'); el?.remove();
  el = document.createElement('div'); el.id = 'ring'; el.className = 'ring-banner';
  el.innerHTML = `<div class="pulse">${I.video}</div><div class="grow"><b>${esc(m.from.name)} is calling</b><div class="small" style="opacity:.75">${esc(m.appointment.reason).slice(0, 60)}</div></div><button class="btn light sm" id="ans">Join</button><button class="btn icon" style="background:rgba(255,255,255,.12)" id="dis">${I.x}</button>`;
  document.body.appendChild(el);
  let audioCtx; try { audioCtx = new (window.AudioContext || window.webkitAudioContext)(); const beep = () => { const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.connect(g); g.connect(audioCtx.destination); o.frequency.value = 880; g.gain.setValueAtTime(.12, audioCtx.currentTime); g.gain.exponentialRampToValueAtTime(.001, audioCtx.currentTime + .4); o.start(); o.stop(audioCtx.currentTime + .4); }; beep(); el._int = setInterval(beep, 1800); } catch { }
  navigator.vibrate?.([300, 150, 300]);
  const stop = () => { clearInterval(el._int); el.remove(); audioCtx?.close(); };
  el.querySelector('#ans').onclick = () => { stop(); navigate('/call/' + m.appointment.room_code); };
  el.querySelector('#dis').onclick = stop;
  setTimeout(stop, 45000);
});

// ---------- PWA plumbing ----------
window.addEventListener('beforeinstallprompt', e => { e.preventDefault(); state.installPrompt = e; if (!localStorage.getItem('nc_install_dismissed') && state.user) showInstallBar(); });
function showInstallBar() {
  if ($('#installBar')) return;
  const el = document.createElement('div'); el.id = 'installBar'; el.className = 'install-bar';
  el.innerHTML = `<span class="logo"><span class="mark">${I.pulse}</span></span><div class="grow"><b>Install NduCare</b><div class="tiny muted">Faster access & call alerts on your home screen</div></div><button class="btn sm" id="ib">Install</button><button class="btn icon ghost" id="ix" style="width:34px;height:34px">${I.x}</button>`;
  document.body.appendChild(el);
  el.querySelector('#ib').onclick = async () => { state.installPrompt?.prompt(); el.remove(); };
  el.querySelector('#ix').onclick = () => { localStorage.setItem('nc_install_dismissed', '1'); el.remove(); };
}
if ('serviceWorker' in navigator) navigator.serviceWorker.register('/sw.js').catch(() => {});
navigator.serviceWorker?.addEventListener('message', e => { if (e.data?.url) navigate(e.data.url); });
const offline = () => { let b = $('#offline'); if (!navigator.onLine) { if (!b) { b = document.createElement('div'); b.id = 'offline'; b.className = 'offline-bar'; b.textContent = 'You are offline — showing saved data'; document.body.appendChild(b); } } else b?.remove(); };
addEventListener('online', offline); addEventListener('offline', offline);

// ---------- boot ----------
(async () => {
  await loadMe();
  if (state.user) { connectWS(); if (state.installPrompt) showInstallBar(); if ('Notification' in window && Notification.permission === 'granted') subscribePush().catch(() => { }); }
  onState(() => { if (state.user && !state.ws) { /* reconnect handled in core */ } });
  render();
})();
