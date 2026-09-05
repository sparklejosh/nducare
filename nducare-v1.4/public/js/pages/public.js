import { state, api, I, $, $$, esc, toast, navigate, loadMe, connectWS, askNotify, route, setToken } from '../core.js';
import { logo } from '../layout.js';

// ---------- Landing ----------
route('/', async () => {
  if (state.user) return navigate('/dashboard', true);
  document.title = 'NduCare — See a doctor in minutes';
  document.getElementById('app').innerHTML = `
  <div class="landing">
    <header>${logo()}<div class="row"><a class="btn ghost sm" href="/login">Sign in</a><a class="btn sm" href="/signup">Get started</a></div></header>
    <section class="hero">
      <div>
        <span class="chip">${I.pulse} Doctors online now in Enugu</span>
        <h1 class="mt">See a <em>licensed doctor</em> on video. Then find the nearest lab & pharmacy.</h1>
        <p class="lead">Describe your symptoms, join a secure video consultation, and receive a verified care plan — with turn-by-turn directions to accredited laboratories and pharmacies closest to you.</p>
        <div class="row wrap"><a class="btn lg" href="/signup">${I.video} Start a consultation</a><a class="btn ghost lg" href="/map">${I.map} Explore facilities</a></div>
        <div class="row wrap mt2 muted small" style="gap:18px"><span class="row" style="gap:6px">${I.shield} MDCN-licensed doctors</span><span class="row" style="gap:6px">${I.check} Verifiable prescriptions</span><span class="row" style="gap:6px">${I.pin} 36 accredited facilities</span></div>
      </div>
      <div class="hero-art">
        <div class="blob"></div>
        <div class="float-card" style="top:8%;left:-4%;animation-delay:.3s"><span class="avatar sm" style="background:hsl(220 70% 50%)">AO</span><div>Dr. Adaeze is ready<br><span class="muted tiny">General Practice · ★ 4.9</span></div></div>
        <div class="float-card" style="bottom:22%;right:-6%;animation-delay:1.2s"><span class="rx-ic">${I.pill}</span><div>Prescription verified<br><span class="muted tiny">Code NC-7K2P9Q</span></div></div>
        <div class="float-card" style="bottom:2%;left:8%;animation-delay:2s"><span class="rx-ic lab">${I.nav}</span><div>SYNLAB · 1.4 km<br><span class="muted tiny">6 min drive</span></div></div>
        <div style="position:absolute;inset:0;display:grid;place-items:center;color:#fff;opacity:.9">${I.video.replace('<svg', '<svg width="110" height="110" stroke-width="1.2"')}</div>
      </div>
    </section>
    <section class="features">
      <div class="grid grid-3">
        ${[[I.video, 'Face-to-face video care', 'Peer-to-peer encrypted WebRTC video with in-call chat. Works in any modern browser — no app store needed.'],
    [I.steth, 'Real specialists', 'GPs, paediatricians, dermatologists, OB-GYNs, psychiatrists — each with an MDCN registration number.'],
    [I.flask, 'Tests, routed', 'Your doctor recommends tests; we match them to labs that run them, sorted by distance from you.'],
    [I.pill, 'Prescriptions, filled', 'Every care plan carries a QR code any pharmacist can scan to verify authenticity in seconds.'],
    [I.map, 'Live directions', 'Driving or walking turn-by-turn routes from your location on an OpenStreetMap-powered map.'],
    [I.download, 'Installable PWA', 'Add NduCare to your home screen. Your care plans stay readable even when your data is off.']]
      .map(([ic, t, d]) => `<div class="feature"><div class="ic">${ic}</div><h3>${t}</h3><p class="muted small mt" style="margin-top:6px">${d}</p></div>`).join('')}
      </div>
      <div class="card dark mt2" style="display:flex;gap:18px;flex-wrap:wrap;align-items:center;justify-content:space-between;padding:26px">
        <div><h2 style="color:#fff">Try the demo instantly</h2><p class="small mt" style="opacity:.8;margin-top:6px">Patient: <span class="kbd" style="color:#111">ada@demo.ng</span> / <span class="kbd" style="color:#111">patient123</span> &nbsp;·&nbsp; Doctor: <span class="kbd" style="color:#111">adaeze@nducare.ng</span> / <span class="kbd" style="color:#111">doctor123</span></p><p class="tiny mt" style="opacity:.6">Open the doctor account in a second browser/device to test a live video call.</p></div>
        <a class="btn light" href="/login">Sign in ${I.back.replace('<svg', '<svg style="transform:rotate(180deg)"')}</a>
      </div>
      <p class="tiny muted mt2" style="text-align:center">NduCare is a telemedicine platform demo. In an emergency call 112 or go to the nearest hospital.</p>
    </section>
  </div>`;
});

// ---------- Auth ----------
const sideArt = `<div>${logo(true)}</div>
  <div class="big"><h1 style="font-size:2.4rem;line-height:1.1;color:#fff">Healthcare that meets you where you are.</h1>
  <p class="mt" style="opacity:.8;max-width:380px;line-height:1.55">Consult a doctor on video, get a verified care plan, and walk into the nearest accredited lab or pharmacy with directions in hand.</p>
  <div class="mt2 col" style="gap:14px">${[['Sign up in 30 seconds', 'No card needed'], ['Video call from your browser', 'Encrypted peer-to-peer'], ['Verified prescriptions', 'QR codes pharmacists trust']].map(([a, b]) => `<div class="row"><span class="avatar sm" style="background:rgba(255,255,255,.12)">${I.check}</span><div><b>${a}</b><div class="tiny" style="opacity:.7">${b}</div></div></div>`).join('')}</div></div>
  <p class="tiny" style="opacity:.5">© ${new Date().getFullYear()} NduCare · Enugu, Nigeria</p>`;

async function afterAuth(user, token) { setToken(token); state.user = user; connectWS(); askNotify(); navigate('/dashboard', true); }

route('/login', () => {
  if (state.user) return navigate('/dashboard', true);
  document.title = 'Sign in · NduCare';
  document.getElementById('app').innerHTML = `<div class="auth"><div class="side">${sideArt}</div><div class="form"><div>
    <h1>Welcome back</h1><p class="muted mt" style="margin-top:6px">Sign in to continue to NduCare.</p>
    <form id="f" class="col mt2" style="gap:14px">
      <div class="field"><label>Email</label><input class="input" name="email" type="email" required autocomplete="email" placeholder="you@example.com"></div>
      <div class="field"><label>Password</label><input class="input" name="password" type="password" required autocomplete="current-password" placeholder="••••••••"></div>
      <button class="btn lg block" id="sb">Sign in</button>
    </form>
    <div class="divider"></div>
    <p class="small muted">Quick demo login:</p>
    <div class="row wrap mt" style="margin-top:8px"><button class="chip click" data-demo="ada@demo.ng|patient123">👩🏾 Patient: Ada</button><button class="chip click" data-demo="adaeze@nducare.ng|doctor123">🩺 Dr. Adaeze (GP)</button><button class="chip click" data-demo="ngozi@nducare.ng|doctor123">🩺 Dr. Ngozi (Paeds)</button></div>
    <p class="mt2 small muted">New here? <a href="/signup"><b>Create an account</b></a></p>
    <div id="apibox" class="notice mt2 hidden" style="flex-direction:column;align-items:stretch;gap:8px"><b>Connect to your backend</b><span class="small">This site can't reach an API server. Paste your backend URL (e.g. <code>https://nducare-api.onrender.com</code>):</span><div class="row"><input class="input grow" id="apiurl" placeholder="https://…"><button class="btn sm" id="apisave">Save</button></div></div>
  </div></div></div>`;
  const f = $('#f');
  fetch((window.NC_API || localStorage.getItem('nc_api') || '') + '/api/health').then(r => r.json()).then(j => { if (!j || j.ok !== true) throw 0; }).catch(() => $('#apibox').classList.remove('hidden'));
  $('#apisave').onclick = () => { const v = $('#apiurl').value.trim().replace(/\/$/, ''); if (!v) return; localStorage.setItem('nc_api', v); location.reload(); };
  f.onsubmit = async e => {
    e.preventDefault(); $('#sb').disabled = true;
    try { const { user, token } = await api('/auth/login', { method: 'POST', body: Object.fromEntries(new FormData(f)) }); afterAuth(user, token); }
    catch (err) { toast('Sign in failed', err.message, 'err'); $('#sb').disabled = false; }
  };
  $$('[data-demo]').forEach(b => b.onclick = () => { const [e, p] = b.dataset.demo.split('|'); f.email.value = e; f.password.value = p; f.requestSubmit(); });
});

route('/signup', ({ query }) => {
  if (state.user) return navigate('/dashboard', true);
  document.title = 'Create account · NduCare';
  let role = query.get('role') === 'doctor' ? 'doctor' : 'patient';
  document.getElementById('app').innerHTML = `<div class="auth"><div class="side">${sideArt}</div><div class="form"><div>
    <h1>Create your account</h1><p class="muted mt" style="margin-top:6px">Join as a patient or a licensed doctor.</p>
    <div class="seg mt2" style="display:flex"><button type="button" data-r="patient" class="grow">I'm a patient</button><button type="button" data-r="doctor" class="grow">I'm a doctor</button></div>
    <form id="f" class="col mt" style="gap:14px">
      <div class="form-grid">
        <div class="field"><label>Full name</label><input class="input" name="name" required placeholder="e.g. Chidi Okafor"></div>
        <div class="field"><label>Phone</label><input class="input" name="phone" placeholder="+234 80X XXX XXXX"></div>
      </div>
      <div class="field"><label>Email</label><input class="input" name="email" type="email" required autocomplete="email"></div>
      <div class="field"><label>Password</label><input class="input" name="password" type="password" required minlength="6" autocomplete="new-password" placeholder="At least 6 characters"></div>
      <div class="form-grid">
        <div class="field"><label>Gender</label><select class="input" name="gender"><option value="">Prefer not to say</option><option value="female">Female</option><option value="male">Male</option></select></div>
        <div class="field pt-only"><label>Date of birth</label><input class="input" name="dob" type="date"></div>
      </div>
      <div class="doc-only col" style="gap:14px">
        <div class="form-grid">
          <div class="field"><label>Specialty</label><select class="input" name="specialty"><option>General Practice</option><option>Internal Medicine</option><option>Paediatrics</option><option>Dermatology</option><option>Obstetrics & Gynaecology</option><option>Mental Health</option><option>Cardiology</option><option>Family Medicine</option><option>ENT</option><option>Ophthalmology</option></select></div>
          <div class="field"><label>MDCN registration no.</label><input class="input" name="mdcn" placeholder="MDCN/R/XXXXX"></div>
        </div>
        <div class="form-grid">
          <div class="field"><label>Consultation fee (₦)</label><input class="input" name="fee" type="number" min="0" step="500" value="3000"></div>
          <div class="field"><label>Short bio</label><input class="input" name="bio" placeholder="Years of experience, interests…"></div>
        </div>
        <div class="notice info">${I.info}<span>Doctor accounts are flagged for credential verification against the MDCN register before going live in production.</span></div>
      </div>
      <button class="btn lg block" id="sb">Create account</button>
      <p class="tiny muted" style="text-align:center">By continuing you agree to our terms and privacy policy.</p>
    </form>
    <p class="mt small muted">Already have an account? <a href="/login"><b>Sign in</b></a></p>
  </div></div></div>`;
  const setRole = r => { role = r; $$('[data-r]').forEach(b => b.classList.toggle('on', b.dataset.r === r)); $('.doc-only').classList.toggle('hidden', r !== 'doctor'); $('.pt-only').classList.toggle('hidden', r === 'doctor'); };
  $$('[data-r]').forEach(b => b.onclick = () => setRole(b.dataset.r)); setRole(role);
  const f = $('#f');
  f.onsubmit = async e => {
    e.preventDefault(); $('#sb').disabled = true;
    try { const { user, token } = await api('/auth/signup', { method: 'POST', body: { ...Object.fromEntries(new FormData(f)), role } }); toast('Welcome to NduCare', `Account created for ${user.name}`, 'ok'); afterAuth(user, token); }
    catch (err) { toast('Could not sign up', err.message, 'err'); $('#sb').disabled = false; }
  };
});

// ---------- Public prescription verification ----------
route('/verify', ({ query }) => renderVerify(query.get('code') || ''));
route('/verify/:code', ({ params }) => renderVerify(params.code));
async function renderVerify(code) {
  document.title = 'Verify prescription · NduCare';
  const inner = `<div style="max-width:640px;margin:0 auto;padding:20px 16px 90px">
    <div class="row between mb">${logo()}${state.user ? '<a class="btn ghost sm" href="/dashboard">Dashboard</a>' : '<a class="btn ghost sm" href="/login">Sign in</a>'}</div>
    <div class="card"><h1>Verify a care plan</h1><p class="muted mt" style="margin-top:6px">Pharmacists and laboratory scientists: enter the code printed on the patient's NduCare care plan (or scan its QR) to confirm it is genuine and unaltered.</p>
      <form id="vf" class="row mt2"><input class="input grow mono" id="vcode" placeholder="NC-XXXXXX" value="${esc(code)}" style="text-transform:uppercase;font-size:1.1rem;letter-spacing:.08em"><button class="btn">${I.search} Verify</button></form>
      <div id="vres" class="mt2"></div></div></div>`;
  document.getElementById('app').innerHTML = `<div class="landing">${inner}</div>`;
  const run = async c => {
    if (!c) return; const box = $('#vres'); box.innerHTML = '<div class="skeleton" style="height:120px"></div>';
    try {
      const { plan } = await api('/verify/' + encodeURIComponent(c.trim()));
      box.innerHTML = `<div class="notice ok">${I.shield}<span><b>Genuine.</b> Issued ${new Date(plan.created_at).toLocaleString('en-NG')} by ${esc(plan.doctor_name)} (${esc(plan.doctor_mdcn)}, ${esc(plan.doctor_specialty)}) for ${esc(plan.patient_name)}.</span></div>
        ${plan.diagnosis ? `<p class="mt"><b>Diagnosis:</b> ${esc(plan.diagnosis)}</p>` : ''}
        ${plan.prescriptions.length ? `<h3 class="mt2">Prescriptions</h3>${plan.prescriptions.map(p => `<div class="rx-line"><div class="rx-ic">${I.pill}</div><div><b>${esc(p.drug)}</b> ${esc(p.strength || '')}<div class="small muted">${esc(p.dose)} · ${esc(p.frequency)} · ${esc(p.duration)}${p.notes ? ' · ' + esc(p.notes) : ''}</div></div><span class="chip gray">Qty ${esc(p.qty || '—')}</span></div>`).join('')}` : ''}
        ${plan.tests.length ? `<h3 class="mt2">Recommended tests</h3>${plan.tests.map(t => `<div class="rx-line"><div class="rx-ic lab">${I.flask}</div><div><b>${esc(t.name)}</b>${t.notes ? `<div class="small muted">${esc(t.notes)}</div>` : ''}</div><span class="chip ${t.urgent ? 'coral' : 'gray'}">${t.urgent ? 'Urgent' : 'Routine'}</span></div>`).join('')}` : ''}`;
    } catch (e) { box.innerHTML = `<div class="notice">${I.info}<span><b>Not found.</b> ${esc(e.message)} — do not dispense against this document.</span></div>`; }
  };
  $('#vf').onsubmit = e => { e.preventDefault(); const c = $('#vcode').value.toUpperCase(); history.replaceState({}, '', '/verify/' + c); run(c); };
  if (code) run(code);
}
