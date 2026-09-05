import { state, api, apiUrl, I, $, $$, esc, avatar, naira, fmtDate, ago, stars, statusLabel, toast, modal, confirmBox, navigate, route, onState, onWS, send, userLoc, locate, km, mins } from '../core.js';
import { shell, pageHead, emptyState } from '../layout.js';

const requireAuth = () => { if (!state.user) { navigate('/login', true); return false; } return true; };

// ---------- Dashboard (both roles) ----------
route('/dashboard', async () => {
  if (!requireAuth()) return;
  if (state.user.role === 'doctor') { const { doctorDashboard } = await import('./doctor.js'); return doctorDashboard(); }
  const u = state.user;
  shell(`<div class="skeleton" style="height:200px"></div>`, 'Home');
  const [{ appointments }, s, { doctors }] = await Promise.all([api('/appointments'), api('/stats'), api('/doctors')]);
  const live = appointments.find(a => a.status === 'in_call') || appointments.find(a => a.status === 'accepted') || appointments.find(a => a.status === 'requested');
  const hour = new Date().getHours(); const greet = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  const online = doctors.filter(d => state.onlineDoctors.has(d.id));
  shell(`
    ${pageHead(`${greet}, ${esc(u.name.split(' ')[0])} 👋`, 'How are you feeling today?')}
    <div class="grid" style="grid-template-columns:1fr;gap:16px">
      ${live ? `<div class="card mint"><div class="row between wrap"><div class="row">${avatar(live.doctor_name, live.doctor_hue, '', state.onlineDoctors.has(live.doctor_id))}<div><div class="row"><b>${esc(live.doctor_name)}</b><span class="status ${live.status}">${statusLabel(live.status)}</span></div><div class="small muted">${esc(live.reason)}</div></div></div>
        <div class="row">${live.status === 'requested' ? `<span class="small muted">Waiting for the doctor to accept…</span>` : `<a class="btn" href="/call/${live.room_code}">${I.video} ${live.status === 'in_call' ? 'Rejoin call' : 'Enter waiting room'}</a>`}<a class="btn ghost sm" href="/appointments/${live.id}">Details</a></div></div></div>` : `
      <div class="card dark" style="display:flex;gap:16px;align-items:center;flex-wrap:wrap;justify-content:space-between;padding:24px">
        <div><h2 style="color:#fff">Need to see a doctor?</h2><p class="small mt" style="opacity:.8;margin-top:6px">${online.length ? `${online.length} doctor${online.length > 1 ? 's are' : ' is'} online right now.` : 'Doctors respond within minutes of your request.'} Average wait: under 5 minutes.</p></div>
        <a class="btn light lg" href="/doctors">${I.video} Start consultation</a></div>`}
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
        <div class="stat"><div class="v">${s.open || 0}</div><div class="l">Open visits</div></div>
        <div class="stat"><div class="v">${s.completed || 0}</div><div class="l">Completed</div></div>
        <div class="stat"><div class="v" style="color:var(--g600)">${s.online_doctors}</div><div class="l">Doctors online</div></div>
      </div>
      ${s.latest_plan ? `<div class="card"><div class="row between"><h3>Latest care plan</h3><span class="chip mono">${s.latest_plan.code}</span></div>
        ${s.latest_plan.diagnosis ? `<p class="mt small"><b>Diagnosis:</b> ${esc(s.latest_plan.diagnosis)}</p>` : ''}
        <div class="row wrap mt">${s.latest_plan.prescriptions.slice(0, 3).map(p => `<span class="chip">${I.pill} ${esc(p.drug)}</span>`).join('')}${s.latest_plan.tests.slice(0, 3).map(t => `<span class="chip blue">${I.flask} ${esc(t.name)}</span>`).join('')}</div>
        <div class="row wrap mt"><a class="btn sm" href="/appointments/${s.latest_plan.appointment_id}">View plan</a>${s.latest_plan.prescriptions.length ? `<a class="btn sm soft" href="/map?type=pharmacy&plan=${s.latest_plan.appointment_id}">${I.pin} Nearest pharmacies</a>` : ''}${s.latest_plan.tests.length ? `<a class="btn sm soft" href="/map?type=lab&plan=${s.latest_plan.appointment_id}">${I.pin} Nearest labs</a>` : ''}</div></div>` : ''}
      <div class="card"><div class="row between mb"><h3>Doctors available now</h3><a class="small" href="/doctors"><b>See all</b></a></div>
        ${online.length ? online.slice(0, 4).map(d => docRow(d)).join('') : `<p class="small muted">No doctors online at this moment — you can still book, and we'll notify you the moment a doctor accepts.</p><div class="mt">${doctors.slice(0, 3).map(d => docRow(d)).join('')}</div>`}</div>
      <div class="card emergency" style="display:flex;gap:14px;align-items:center;flex-wrap:wrap"><span class="rx-ic" style="width:46px;height:46px">${I.phone}</span><div class="grow"><b style="color:var(--coral-600)">Emergency?</b><div class="small muted">Severe chest pain, breathing difficulty, heavy bleeding or seizures — don't book, call now.</div></div><a class="btn red" href="tel:112">${I.phone} Call 112</a></div>
      <div class="grid grid-3">
        <a class="card" href="/map?type=lab" style="display:flex;gap:12px;align-items:center"><span class="rx-ic lab">${I.flask}</span><div><b>Accredited labs</b><div class="small muted">MLSCN-registered, near you</div></div></a>
        <a class="card" href="/map?type=pharmacy" style="display:flex;gap:12px;align-items:center"><span class="rx-ic">${I.pill}</span><div><b>Pharmacies</b><div class="small muted">PCN-registered, near you</div></div></a>
        <a class="card" href="/appointments" style="display:flex;gap:12px;align-items:center"><span class="rx-ic" style="background:var(--amber-100);color:#8a5a00">${I.cal}</span><div><b>Visit history</b><div class="small muted">All your consultations</div></div></a>
      </div>
    </div>`, 'Home');
  return onState(() => { $$('[data-doc-dot]').forEach(el => el.classList.toggle('on', state.onlineDoctors.has(+el.dataset.docDot))); });
});
const docRow = d => `<div class="list-item"><a href="/doctors/${d.id}">${avatar(d.name, d.avatar_hue, '', state.onlineDoctors.has(d.id))}</a><div class="grow"><a href="/doctors/${d.id}" style="color:inherit"><b>${esc(d.name)}</b></a><div class="small muted">${esc(d.specialty)} · ${d.rating ? `<span class="stars">${stars(d.rating)}</span> ${d.rating}` : 'New'}</div></div><a class="btn sm" href="/book/${d.id}">Consult · ${naira(d.fee)}</a></div>`;

// ---------- Doctors list ----------
route('/doctors', async ({ query }) => {
  if (!requireAuth()) return;
  shell('<div class="skeleton" style="height:300px"></div>', 'Doctors');
  const { doctors } = await api('/doctors');
  const specs = [...new Set(doctors.map(d => d.specialty))];
  let spec = query.get('spec') || '', q = '', onlyOnline = false;
  const draw = () => {
    const list = doctors.filter(d => (!spec || d.specialty === spec) && (!q || d.name.toLowerCase().includes(q) || d.specialty.toLowerCase().includes(q) || (d.bio || '').toLowerCase().includes(q)) && (!onlyOnline || state.onlineDoctors.has(d.id)))
      .sort((a, b) => (state.onlineDoctors.has(b.id) - state.onlineDoctors.has(a.id)) || ((b.rating || 0) - (a.rating || 0)));
    $('#docs').innerHTML = list.length ? list.map(d => `<div class="card doc-card" onclick="location.assign('/doctors/${d.id}')">
      <div class="top">${avatar(d.name, d.avatar_hue, 'lg', state.onlineDoctors.has(d.id))}<div class="grow"><b>${esc(d.name)}</b><div class="small muted">${esc(d.specialty)}</div><div class="small ${state.onlineDoctors.has(d.id) ? '' : 'muted'}" style="color:var(--g600);font-weight:650">${state.onlineDoctors.has(d.id) ? '● Online now' : 'Offline · books ahead'}</div></div></div>
      <p class="small muted" style="line-height:1.5;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden">${esc(d.bio || '')}</p>
      <div class="row between"><div class="small">${d.rating ? `<span class="stars">${stars(d.rating)}</span> <b>${d.rating}</b> <span class="muted">(${d.review_count})</span>` : '<span class="chip gray">New on NduCare</span>'} <span class="muted"> · ${d.consults} consults</span></div><span class="fee">${naira(d.fee)}</span></div>
      <a class="btn block" href="/book/${d.id}" onclick="event.stopPropagation()">${I.video} Consult now</a></div>`).join('') : emptyState(I.steth, 'No doctors match your filters.');
  };
  shell(`${pageHead('Find a doctor', 'Licensed, verified, and ready to see you on video.')}
    <div class="row wrap mb"><div class="grow" style="position:relative;min-width:220px"><input class="input" id="q" placeholder="Search by name, specialty or condition…" style="padding-left:40px"><span style="position:absolute;left:12px;top:12px;color:var(--ink-3);width:18px">${I.search}</span></div><button class="chip click" id="onl">${I.pulse} Online only</button></div>
    <div class="row wrap mb" id="specs"><button class="chip click ${!spec ? 'on' : ''}" data-s="">All</button>${specs.map(s => `<button class="chip click ${spec === s ? 'on' : ''}" data-s="${esc(s)}">${esc(s)}</button>`).join('')}</div>
    <div class="grid grid-2" id="docs"></div>`, 'Doctors');
  $('#q').oninput = e => { q = e.target.value.toLowerCase(); draw(); };
  $('#onl').onclick = e => { onlyOnline = !onlyOnline; e.currentTarget.classList.toggle('on', onlyOnline); draw(); };
  $$('[data-s]').forEach(b => b.onclick = () => { spec = b.dataset.s; $$('[data-s]').forEach(x => x.classList.toggle('on', x === b)); draw(); });
  draw();
  return onState(draw);
});

route('/doctors/:id', async ({ params }) => {
  if (!requireAuth()) return;
  shell('<div class="skeleton" style="height:300px"></div>');
  const { doctors } = await api('/doctors'); const d = doctors.find(x => x.id === +params.id);
  if (!d) return navigate('/doctors', true);
  shell(`<a class="row small mb" href="/doctors" style="gap:6px">${I.back} All doctors</a>
    <div class="card"><div class="row wrap" style="gap:18px;align-items:flex-start">${avatar(d.name, d.avatar_hue, 'lg', state.onlineDoctors.has(d.id))}<div class="grow"><h1>${esc(d.name)}</h1><p class="muted">${esc(d.specialty)} · ${esc(d.mdcn)}</p>
      <div class="row wrap mt"><span class="chip ${state.onlineDoctors.has(d.id) ? '' : 'gray'}">${state.onlineDoctors.has(d.id) ? '● Online now' : 'Offline'}</span>${d.rating ? `<span class="chip amber">★ ${d.rating} (${d.review_count} reviews)</span>` : ''}<span class="chip outline">${d.consults} consultations</span><span class="chip outline">${I.shield} MDCN verified</span></div></div>
      <div style="text-align:right"><div class="fee" style="font-size:1.5rem">${naira(d.fee)}</div><div class="tiny muted">per consultation</div></div></div>
      <p class="mt2" style="line-height:1.6">${esc(d.bio || '')}</p>
      <div class="divider"></div>
      <div class="row wrap between"><div class="small muted">Typical response: <b>under 5 minutes</b> when online</div><a class="btn lg" href="/book/${d.id}">${I.video} Book consultation</a></div></div>`, d.name);
});

// ---------- Booking wizard ----------
const SYMPTOMS = ['Fever', 'Headache', 'Cough', 'Sore throat', 'Body aches', 'Fatigue', 'Nausea/Vomiting', 'Diarrhoea', 'Abdominal pain', 'Chest pain', 'Shortness of breath', 'Rash/Itching', 'Dizziness', 'Loss of appetite', 'Joint pain', 'Back pain', 'Anxiety/Low mood', 'Insomnia', 'Painful urination', 'Menstrual issues'];
route('/book/:id', async ({ params }) => {
  if (!requireAuth()) return;
  if (state.user.role !== 'patient') return navigate('/dashboard', true);
  const { doctors } = await api('/doctors'); const d = doctors.find(x => x.id === +params.id);
  if (!d) return navigate('/doctors', true);
  let step = 0; const data = { symptoms: [], urgency: 'routine', reason: '', duration: '' };
  const draw = () => {
    const steps = [`
      <h2>What brings you in today?</h2><p class="muted small mt">Select all symptoms that apply.</p>
      <div class="symptom-grid mt">${SYMPTOMS.map(s => `<button class="chip click ${data.symptoms.includes(s) ? 'on' : ''}" data-sym="${s}">${s}</button>`).join('')}</div>
      <div class="field mt2"><label>Describe it in your own words *</label><textarea class="input" id="reason" placeholder="e.g. Fever and chills for 3 days, worse at night. Took paracetamol with little relief.">${esc(data.reason)}</textarea></div>
      <div class="form-grid mt"><div class="field"><label>How long?</label><select class="input" id="dur"><option value="">Select…</option>${['Less than a day', '1–3 days', '4–7 days', '1–4 weeks', 'Over a month'].map(x => `<option ${data.duration === x ? 'selected' : ''}>${x}</option>`).join('')}</select></div>
      <div class="field"><label>Urgency</label><select class="input" id="urg"><option value="routine" ${data.urgency === 'routine' ? 'selected' : ''}>Routine — soon is fine</option><option value="soon" ${data.urgency === 'soon' ? 'selected' : ''}>Today please</option><option value="urgent" ${data.urgency === 'urgent' ? 'selected' : ''}>Urgent — I feel quite unwell</option></select></div></div>
      <div class="notice mt">${I.info}<span>If you have severe chest pain, difficulty breathing, heavy bleeding or a seizure, call <b>112</b> or go to the nearest emergency room now.</span></div>`,
    `<h2>Confirm your consultation</h2>
      <div class="list-item">${avatar(d.name, d.avatar_hue, '', state.onlineDoctors.has(d.id))}<div class="grow"><b>${esc(d.name)}</b><div class="small muted">${esc(d.specialty)}</div></div><span class="fee">${naira(d.fee)}</span></div>
      <div class="mt"><div class="small muted">Reason</div><p>${esc(data.reason)}</p></div>
      <div class="row wrap mt">${data.symptoms.map(s => `<span class="chip">${s}</span>`).join('') || '<span class="muted small">No symptoms tagged</span>'}</div>
      <div class="row wrap mt small muted"><span>Duration: <b>${esc(data.duration || '—')}</b></span><span>·</span><span>Urgency: <b>${data.urgency}</b></span></div>
      <div class="divider"></div>
      <div class="card" style="background:var(--g50);box-shadow:none"><div class="row between"><span>Consultation fee</span><b>${naira(d.fee)}</b></div><div class="row between small muted mt" style="margin-top:6px"><span>Payment</span><span>Pay after consultation (demo)</span></div></div>
      <div class="row mt small muted" style="gap:6px">${I.shield} Your medical details are shared only with ${esc(d.name.split(' ').slice(0, 2).join(' '))}.</div>`];
    shell(`<a class="row small mb" href="/doctors/${d.id}" style="gap:6px">${I.back} Back</a>
      <div style="max-width:680px;margin:0 auto"><div class="stepper mb"><i class="${step >= 0 ? 'on' : ''}"></i><i class="${step >= 1 ? 'on' : ''}"></i></div>
      <div class="card">${steps[step]}
        <div class="row mt2" style="justify-content:flex-end">${step > 0 ? '<button class="btn ghost" id="prev">Back</button>' : ''}<button class="btn lg" id="next">${step === 0 ? 'Continue' : `${I.video} Request consultation`}</button></div></div></div>`, 'Book');
    $$('[data-sym]').forEach(b => b.onclick = () => { const s = b.dataset.sym; data.symptoms.includes(s) ? data.symptoms.splice(data.symptoms.indexOf(s), 1) : data.symptoms.push(s); b.classList.toggle('on'); });
    $('#prev') && ($('#prev').onclick = () => { step--; draw(); });
    $('#next').onclick = async () => {
      if (step === 0) { data.reason = $('#reason').value.trim(); data.duration = $('#dur').value; data.urgency = $('#urg').value; if (data.reason.length < 3) return toast('Tell us a bit more', 'Please describe your reason for the visit.', 'err'); step = 1; return draw(); }
      $('#next').disabled = true;
      try {
        const { appointment } = await api('/appointments', { method: 'POST', body: { doctor_id: d.id, reason: data.reason, symptoms: data.symptoms, urgency: data.urgency, duration: data.duration } });
        toast('Request sent', `${d.name} has been notified.`, 'ok'); await payFor(appointment.id, d.fee); navigate('/appointments/' + appointment.id);
      } catch (e) { $('#next').disabled = false; if (e.data?.appointment_id) { toast('Already open', e.message, 'err'); navigate('/appointments/' + e.data.appointment_id); } else toast('Could not book', e.message, 'err'); }
    };
  };
  draw();
});

// ---------- Payment (Paystack or demo) ----------
export async function payFor(apptId, fee) {
  try {
    const r = await api(`/appointments/${apptId}/pay/init`, { method: 'POST' });
    if (r.paid) { if (r.demo && fee > 0) toast('Demo payment recorded', `${naira(fee)} — connect Paystack keys to charge for real.`, 'ok'); return true; }
    // Paystack inline popup, fallback to redirect
    await new Promise((res) => {
      if (window.PaystackPop) return res();
      const sc = document.createElement('script'); sc.src = 'https://js.paystack.co/v1/inline.js'; sc.onload = res; sc.onerror = res; document.head.appendChild(sc);
    });
    if (window.PaystackPop) {
      return await new Promise(res => {
        const h = window.PaystackPop.setup({ key: r.public_key, email: r.email, amount: r.amount * 100, currency: 'NGN', ref: r.reference,
          callback: async () => { try { const v = await api('/payments/verify', { method: 'POST', body: { reference: r.reference } }); v.paid ? toast('Payment confirmed', naira(fee), 'ok') : toast('Payment pending', 'We will confirm shortly.'); res(!!v.paid); } catch { res(false); } },
          onClose: () => { toast('Payment not completed', 'You can pay from the visit page.', 'err'); res(false); } });
        h.openIframe();
      });
    }
    location.href = r.authorization_url; return false;
  } catch (e) { toast('Payment error', e.message, 'err'); return false; }
}

// ---------- Appointments list ----------
route('/appointments', async () => {
  if (!requireAuth()) return;
  shell('<div class="skeleton" style="height:300px"></div>', 'Visits');
  const draw = async () => {
    const { appointments } = await api('/appointments');
    const isDoc = state.user.role === 'doctor';
    const open = appointments.filter(a => ['requested', 'accepted', 'in_call'].includes(a.status)), past = appointments.filter(a => !open.includes(a));
    const item = a => `<a class="list-item" href="/appointments/${a.id}" style="color:inherit">${avatar(isDoc ? a.patient_name : a.doctor_name, isDoc ? a.patient_hue : a.doctor_hue, '', isDoc ? undefined : state.onlineDoctors.has(a.doctor_id))}<div class="grow"><div class="row"><b>${esc(isDoc ? a.patient_name : a.doctor_name)}</b><span class="status ${a.status}">${statusLabel(a.status)}</span></div><div class="small muted" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(a.reason)}</div><div class="tiny muted">${ago(a.created_at)}${a.plan_code ? ` · Plan ${a.plan_code}` : ''}</div></div>${a.status === 'in_call' || a.status === 'accepted' ? `<span class="btn sm">${I.video}</span>` : ''}</a>`;
    shell(`${pageHead(isDoc ? 'Consultations' : 'My visits', '', isDoc ? '' : `<a class="btn" href="/doctors">${I.plus} New consultation</a>`)}
      <div class="card"><h3 class="mb">Active</h3>${open.length ? open.map(item).join('') : emptyState(I.video, 'No active consultations.')}</div>
      <div class="card mt"><h3 class="mb">History</h3>${past.length ? past.map(item).join('') : emptyState(I.cal, 'Your completed visits will appear here.')}</div>`, 'Visits');
  };
  await draw();
  const offs = [onWS('appointment:update', draw), onWS('appointment:new', draw)];
  return () => offs.forEach(f => f());
});

// ---------- Appointment detail + care plan ----------
route('/appointments/:id', async ({ params }) => {
  if (!requireAuth()) return;
  shell('<div class="skeleton" style="height:300px"></div>');
  const isDoc = state.user.role === 'doctor';
  const draw = async () => {
    let data; try { data = await api('/appointments/' + params.id); } catch { return navigate('/appointments', true); }
    const { appointment: a, plan, review } = data;
    const other = isDoc ? { name: a.patient_name, hue: a.patient_hue } : { name: a.doctor_name, hue: a.doctor_hue };
    const symptoms = JSON.parse(a.symptoms || '[]');
    const canCall = ['accepted', 'in_call'].includes(a.status) && (isDoc || a.paid);
    const q = new URLSearchParams(location.search);
    if (q.get('pay') === 'verify' && q.get('ref') && !a.paid) { try { const v = await api('/payments/verify', { method: 'POST', body: { reference: q.get('ref') } }); if (v.paid) { toast('Payment confirmed', '', 'ok'); history.replaceState({}, '', location.pathname); return draw(); } } catch { } }
    shell(`<a class="row small mb no-print" href="${isDoc ? '/queue' : '/appointments'}" style="gap:6px">${I.back} ${isDoc ? 'Queue' : 'My visits'}</a>
      <div class="grid" style="grid-template-columns:1fr;max-width:820px;margin:0 auto">
        <div class="card"><div class="row between wrap"><div class="row">${avatar(other.name, other.hue, 'lg', isDoc ? undefined : state.onlineDoctors.has(a.doctor_id))}<div><h2>${esc(other.name)}</h2><div class="small muted">${isDoc ? `Patient · ${a.patient_gender || ''} ${a.patient_dob ? '· ' + Math.floor((Date.now() - new Date(a.patient_dob)) / 3.15576e10) + ' yrs' : ''}` : esc(a.doctor_specialty)}</div><span class="status ${a.status}">${statusLabel(a.status)}</span></div></div>
          <div class="row wrap no-print">${canCall ? `<a class="btn lg" href="/call/${a.room_code}">${I.video} ${a.status === 'in_call' ? 'Rejoin call' : isDoc ? 'Start video call' : 'Join call'}</a>` : ''}
            ${isDoc && a.status === 'requested' ? `<button class="btn lg" id="accept">${I.check} Accept</button><button class="btn ghost" id="decline">Decline</button>` : ''}
            ${!isDoc && ['requested', 'accepted'].includes(a.status) ? `<button class="btn ghost" id="cancel">Cancel</button>` : ''}
            ${isDoc && ['accepted', 'in_call'].includes(a.status) ? `<button class="btn ghost" id="complete">Mark completed</button>` : ''}</div></div>
          ${!isDoc && !a.paid && !['declined', 'cancelled', 'completed'].includes(a.status) ? `<div class="notice mt">${I.info}<span class="grow"><b>Payment required</b> — ${naira(a.doctor_fee)} consultation fee. You'll be able to join the call once paid.</span><button class="btn sm" id="payBtn">Pay now</button></div>` : ''}
          ${a.status === 'requested' && !isDoc ? `<div class="notice info mt">${I.clock}<span>Waiting for ${esc(a.doctor_name)} to accept. You'll get a notification — keep this tab open or install the app.</span></div>` : ''}
          ${a.status === 'accepted' && !isDoc ? `<div class="notice ok mt">${I.video}<span>Accepted! Join the call room — the doctor will connect shortly. Check your camera and microphone.</span></div>` : ''}
          <div class="divider"></div>
          <div class="small muted">Reason for visit</div><p style="line-height:1.55">${esc(a.reason)}</p>
          <div class="row wrap mt">${symptoms.map(s => `<span class="chip">${s}</span>`).join('')}<span class="chip ${a.urgency === 'urgent' ? 'coral' : a.urgency === 'soon' ? 'amber' : 'gray'}">${a.urgency}</span></div>
          ${isDoc ? `<div class="row wrap mt small"><span class="chip ${a.paid ? 'outline' : 'amber'}">${a.paid ? '✓ Paid' : 'Unpaid'}</span><span class="chip outline">Blood group: ${esc(a.patient_blood || '—')}</span><span class="chip ${a.patient_allergies ? 'coral' : 'outline'}">Allergies: ${esc(a.patient_allergies || 'none recorded')}</span><span class="chip outline">${esc(a.patient_phone || '')}</span></div>` : ''}
          <div class="timeline mt2 small"><div class="t"><b>Requested</b> <span class="muted">${fmtDate(a.created_at)}</span></div>${a.started_at ? `<div class="t"><b>Call started</b> <span class="muted">${fmtDate(a.started_at)}</span></div>` : ''}${a.ended_at ? `<div class="t"><b>Completed</b> <span class="muted">${fmtDate(a.ended_at)}</span></div>` : ''}</div>
        </div>
        ${isDoc ? `<div class="card no-print"><div class="row between"><h3>Care plan</h3>${plan ? `<span class="chip mono">${plan.code}</span>` : ''}</div><p class="small muted mt">Write the diagnosis, prescriptions and recommended tests. The patient sees it instantly and gets matched to nearby facilities.</p><button class="btn mt" id="editPlan">${plan ? 'Edit care plan' : I.plus + ' Write care plan'}</button></div>` : ''}
        ${plan ? carePlanCard(a, plan, isDoc) : (!isDoc ? `<div class="card"><h3>Care plan</h3><p class="small muted mt">Your doctor's diagnosis, prescriptions and recommended tests will appear here after the consultation.</p></div>` : '')}
        ${!isDoc && a.status === 'completed' ? `<div class="card no-print"><h3>${review ? 'Your rating' : 'Rate this consultation'}</h3>${review ? `<div class="stars mt" style="font-size:1.4rem">${stars(review.stars)}</div><p class="small muted">${esc(review.comment || '')}</p>` : `<div class="rating-input mt" id="rate">${[1, 2, 3, 4, 5].map(i => `<span data-v="${i}">★</span>`).join('')}</div><textarea class="input mt" id="rcomment" placeholder="Optional comment"></textarea><button class="btn mt" id="sendReview">Submit</button>`}</div>` : ''}
      </div>`, 'Consultation');
    const setStatus = async (status) => { try { await api(`/appointments/${a.id}/status`, { method: 'POST', body: { status } }); draw(); } catch (e) { toast('Error', e.message, 'err'); } };
    $('#payBtn') && ($('#payBtn').onclick = async () => { if (await payFor(a.id, a.doctor_fee)) draw(); });
    $('#accept') && ($('#accept').onclick = async () => { await setStatus('accepted'); toast('Accepted', 'Patient notified. Start the video call when ready.', 'ok'); });
    $('#decline') && ($('#decline').onclick = async () => (await confirmBox('Decline consultation?', 'The patient will be told to book another doctor.', 'Decline', true)) && setStatus('declined'));
    $('#cancel') && ($('#cancel').onclick = async () => (await confirmBox('Cancel consultation?', 'You can book again anytime.', 'Cancel visit', true)) && setStatus('cancelled'));
    $('#complete') && ($('#complete').onclick = async () => (await confirmBox('Mark as completed?', 'Make sure the care plan is written first.', 'Complete')) && setStatus('completed'));
    $('#editPlan') && ($('#editPlan').onclick = async () => { const { planEditor } = await import('./doctor.js'); planEditor(a, plan, draw); });
    if ($('#rate')) { let v = 5; const paint = () => $$('#rate span').forEach(s => s.classList.toggle('on', +s.dataset.v <= v)); paint(); $$('#rate span').forEach(s => s.onclick = () => { v = +s.dataset.v; paint(); }); $('#sendReview').onclick = async () => { await api(`/appointments/${a.id}/review`, { method: 'POST', body: { stars: v, comment: $('#rcomment').value } }); toast('Thank you!', 'Your feedback helps other patients.', 'ok'); draw(); }; }
    $('#printPlan') && ($('#printPlan').onclick = () => window.print());
    $('#copyCode') && ($('#copyCode').onclick = () => { navigator.clipboard?.writeText(plan.code); toast('Copied', plan.code, 'ok'); });
    $('#sharePlan') && ($('#sharePlan').onclick = () => { const url = `${location.origin}/verify/${plan.code}`; navigator.share ? navigator.share({ title: 'NduCare care plan', text: `Care plan ${plan.code}`, url }) : (navigator.clipboard?.writeText(url), toast('Link copied', url, 'ok')); });
  };
  await draw();
  const offs = [onWS('appointment:update', draw), onWS('plan:update', draw)];
  return () => offs.forEach(f => f());
});

export function carePlanCard(a, plan, isDoc) {
  const testNames = plan.tests.map(t => t.name);
  return `<div class="card" id="plan">
    <div class="row between wrap"><div><h2>Care plan</h2><div class="small muted">Issued by ${esc(a.doctor_name)} · ${esc(a.doctor_mdcn)} · ${fmtDate(plan.created_at)}</div></div>
      <div class="row"><img src="${apiUrl('/qr')}?text=${encodeURIComponent(location.origin + '/verify/' + plan.code)}" alt="QR" width="76" height="76" style="border-radius:8px;background:#fff;border:1px solid var(--line)"><div><div class="tiny muted">Verification code</div><div class="mono" style="font-weight:800;font-size:1.1rem;letter-spacing:.06em">${plan.code}</div><button class="btn sm ghost no-print" id="copyCode" style="margin-top:4px">${I.copy} Copy</button></div></div></div>
    ${plan.diagnosis ? `<div class="mt2"><div class="small muted">Diagnosis / assessment</div><p style="font-weight:650;font-size:1.05rem">${esc(plan.diagnosis)}</p></div>` : ''}
    ${plan.notes ? `<div class="mt"><div class="small muted">Clinical notes</div><p style="line-height:1.55">${esc(plan.notes)}</p></div>` : ''}
    ${plan.prescriptions.length ? `<div class="mt2"><div class="row between"><h3>${I.pill} Prescriptions</h3>${!isDoc ? `<a class="btn sm soft no-print" href="/map?type=pharmacy&plan=${a.id}">${I.pin} Nearest pharmacies</a>` : ''}</div>
      ${plan.prescriptions.map(p => `<div class="rx-line"><div class="rx-ic">${I.pill}</div><div><b>${esc(p.drug)}</b> <span class="muted">${esc(p.strength || '')}</span><div class="small">${esc(p.dose)} · ${esc(p.frequency)} · for ${esc(p.duration)}</div>${p.notes ? `<div class="small muted">${esc(p.notes)}</div>` : ''}</div><span class="chip gray">Qty ${esc(p.qty || '—')}</span></div>`).join('')}</div>` : ''}
    ${plan.tests.length ? `<div class="mt2"><div class="row between"><h3>${I.flask} Recommended tests</h3>${!isDoc ? `<a class="btn sm soft no-print" href="/map?type=lab&plan=${a.id}">${I.pin} Labs that run these</a>` : ''}</div>
      ${plan.tests.map(t => `<div class="rx-line"><div class="rx-ic lab">${I.flask}</div><div><b>${esc(t.name)}</b>${t.notes ? `<div class="small muted">${esc(t.notes)}</div>` : ''}</div><span class="chip ${t.urgent ? 'coral' : 'gray'}">${t.urgent ? 'Urgent' : 'Routine'}</span></div>`).join('')}</div>` : ''}
    ${plan.advice ? `<div class="notice ok mt2">${I.heart}<span><b>Advice:</b> ${esc(plan.advice)}</span></div>` : ''}
    ${plan.follow_up_days ? `<p class="small mt">${I.clock.replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')} Follow-up in <b>${plan.follow_up_days} day${plan.follow_up_days > 1 ? 's' : ''}</b></p>` : ''}
    <div class="row wrap mt2 no-print"><button class="btn ghost sm" id="printPlan">${I.print} Print / Save PDF</button><button class="btn ghost sm" id="sharePlan">${I.copy} Share verification link</button></div>
    <p class="tiny muted mt">Pharmacists & labs can verify this plan at ${location.host}/verify/${plan.code}</p></div>`;
}

// ---------- Profile ----------
route('/profile', async () => {
  if (!requireAuth()) return;
  const u = state.user; const isDoc = u.role === 'doctor';
  shell(`${pageHead('Profile')}
    <div class="card" style="max-width:680px"><div class="row mb">${avatar(u.name, u.avatar_hue, 'lg')}<div><h2>${esc(u.name)}</h2><div class="small muted">${esc(u.email)} · ${isDoc ? esc(u.specialty) : 'Patient'}</div></div></div>
    <form id="pf" class="col" style="gap:14px">
      <div class="form-grid"><div class="field"><label>Full name</label><input class="input" name="name" value="${esc(u.name)}"></div><div class="field"><label>Phone</label><input class="input" name="phone" value="${esc(u.phone || '')}"></div></div>
      ${isDoc ? `<div class="form-grid"><div class="field"><label>Specialty</label><input class="input" name="specialty" value="${esc(u.specialty || '')}"></div><div class="field"><label>Fee (₦)</label><input class="input" name="fee" type="number" value="${u.fee || 0}"></div></div><div class="field"><label>Bio</label><textarea class="input" name="bio">${esc(u.bio || '')}</textarea></div>`
      : `<div class="form-grid"><div class="field"><label>Date of birth</label><input class="input" type="date" name="dob" value="${esc(u.dob || '')}"></div><div class="field"><label>Gender</label><select class="input" name="gender"><option value="">—</option><option value="female" ${u.gender === 'female' ? 'selected' : ''}>Female</option><option value="male" ${u.gender === 'male' ? 'selected' : ''}>Male</option></select></div>
        <div class="field"><label>Blood group</label><select class="input" name="blood_group"><option value="">Unknown</option>${['O+', 'O-', 'A+', 'A-', 'B+', 'B-', 'AB+', 'AB-'].map(b => `<option ${u.blood_group === b ? 'selected' : ''}>${b}</option>`).join('')}</select></div><div class="field"><label>Allergies</label><input class="input" name="allergies" value="${esc(u.allergies || '')}" placeholder="e.g. Penicillin"></div></div>`}
      <button class="btn">Save changes</button></form></div>
    <div class="card mt" style="max-width:680px"><h3>Location</h3><p class="small muted mt">Used to sort labs and pharmacies by distance. ${state.loc ? `Last fix: ${state.loc.lat.toFixed(4)}, ${state.loc.lng.toFixed(4)} (±${Math.round(state.loc.acc || 0)} m)` : 'Not set — defaulting to Enugu city centre.'}</p><button class="btn soft mt" id="loc">${I.locate} Update my location</button></div>
    <div class="card mt" style="max-width:680px"><h3>App</h3><p class="small muted mt">Install NduCare on your device for faster access and call notifications.</p><div class="row wrap mt"><button class="btn soft" id="inst">${I.download} Install app</button><button class="btn ghost" id="notif">${I.bell} Enable notifications</button></div></div>`, 'Profile');
  $('#pf').onsubmit = async e => { e.preventDefault(); try { const { user } = await api('/auth/me', { method: 'PATCH', body: Object.fromEntries(new FormData(e.target)) }); state.user = user; toast('Saved', 'Profile updated', 'ok'); } catch (err) { toast('Error', err.message, 'err'); } };
  $('#loc').onclick = async () => { const l = await locate(); if (l) { await api('/auth/me', { method: 'PATCH', body: { lat: l.lat, lng: l.lng } }); toast('Location updated', `${l.lat.toFixed(4)}, ${l.lng.toFixed(4)}`, 'ok'); } };
  $('#inst').onclick = async () => { if (state.installPrompt) { state.installPrompt.prompt(); } else toast('Install', 'Use your browser menu → "Add to Home screen" / "Install app".'); };
  $('#notif').onclick = async () => { await Notification.requestPermission(); toast('Notifications', Notification.permission === 'granted' ? 'Enabled' : 'Blocked in browser settings', Notification.permission === 'granted' ? 'ok' : 'err'); };
});
