import { state, api, I, $, $$, esc, avatar, ago, statusLabel, toast, modal, navigate, route, onWS, stars } from '../core.js';
import { shell, pageHead, emptyState } from '../layout.js';

const COMMON_TESTS = ['Full Blood Count', 'Malaria Parasite', 'Widal Test', 'Fasting Blood Sugar', 'HbA1c', 'Lipid Profile', 'Liver Function Test', 'Kidney Function Test', 'Electrolytes (E/U/Cr)', 'Urinalysis', 'Thyroid Function Test', 'HIV Screening', 'Hepatitis B Surface Antigen', 'Pregnancy Test (βhCG)', 'Stool Microscopy', 'PSA', 'Blood Group & Genotype', 'Ultrasound Scan', 'X-Ray', 'ECG', 'Microbiology Culture & Sensitivity', 'Semen Analysis'];
const COMMON_DRUGS = [['Artemether/Lumefantrine', '80/480 mg', '1 tablet', 'Twice daily', '3 days', 6], ['Paracetamol', '500 mg', '2 tablets', 'Every 8 hours as needed', '5 days', 30], ['Amoxicillin/Clavulanate', '625 mg', '1 tablet', 'Twice daily', '7 days', 14], ['Omeprazole', '20 mg', '1 capsule', 'Once daily before breakfast', '14 days', 14], ['Amlodipine', '5 mg', '1 tablet', 'Once daily', '30 days', 30], ['Metformin', '500 mg', '1 tablet', 'Twice daily with meals', '30 days', 60], ['Cetirizine', '10 mg', '1 tablet', 'Once daily at night', '7 days', 7], ['Ibuprofen', '400 mg', '1 tablet', 'Three times daily after food', '5 days', 15], ['ORS sachets', '', '1 sachet in 1 L water', 'After each loose stool', '3 days', 10], ['Vitamin C', '1000 mg', '1 tablet', 'Once daily', '14 days', 14]];

export async function doctorDashboard() {
  const u = state.user;
  shell('<div class="skeleton" style="height:300px"></div>', 'Dashboard');
  const draw = async () => {
    const [{ appointments }, s] = await Promise.all([api('/appointments'), api('/stats')]);
    const pending = appointments.filter(a => a.status === 'requested'), active = appointments.filter(a => ['accepted', 'in_call'].includes(a.status));
    shell(`${pageHead(`Hello, ${esc(u.name.split(' ').slice(0, 2).join(' '))}`, `${esc(u.specialty)} · ${state.ws ? '<span style="color:var(--g600);font-weight:700">● You are visible as online</span>' : '<span style="color:var(--coral)">● Reconnecting…</span>'}`)}
      <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(140px,1fr))">
        <div class="stat"><div class="v" style="color:${pending.length ? 'var(--coral)' : 'inherit'}">${pending.length}</div><div class="l">Waiting</div></div>
        <div class="stat"><div class="v">${s.today || 0}</div><div class="l">Seen today</div></div>
        <div class="stat"><div class="v">${s.completed || 0}</div><div class="l">Total consults</div></div>
        <div class="stat"><div class="v">${s.rating ? s.rating + ' ★' : '—'}</div><div class="l">${s.reviews || 0} reviews</div></div></div>
      ${active.length ? `<div class="card mint mt"><h3 class="mb">In progress</h3>${active.map(a => `<div class="list-item">${avatar(a.patient_name, a.patient_hue)}<div class="grow"><div class="row"><b>${esc(a.patient_name)}</b><span class="status ${a.status}">${statusLabel(a.status)}</span></div><div class="small muted">${esc(a.reason)}</div></div><a class="btn" href="/call/${a.room_code}">${I.video} ${a.status === 'in_call' ? 'Rejoin' : 'Call'}</a><a class="btn ghost sm" href="/appointments/${a.id}">Chart</a></div>`).join('')}</div>` : ''}
      <div class="card mt"><div class="row between mb"><h3>Waiting room</h3><a class="small" href="/queue"><b>Full queue</b></a></div>
        ${pending.length ? pending.map(a => queueRow(a)).join('') : emptyState(I.clock, 'No patients waiting. New requests will appear here in real time.')}</div>
      <div class="card mt"><h3>Quick tips</h3><ul class="small muted mt" style="padding-left:18px;line-height:1.8"><li>Accept a request, then press <b>Start video call</b> — the patient's device will ring.</li><li>Write the care plan during or after the call; the patient gets nearby pharmacy & lab matches instantly.</li><li>Keep this tab open (or install the app) to stay visible as <b>online</b> to patients.</li></ul></div>`, 'Dashboard');
    bindQueue(draw);
  };
  await draw();
  const offs = [onWS('appointment:new', draw), onWS('appointment:update', draw), onWS('open', draw)];
  return () => offs.forEach(f => f());
}

const queueRow = a => { const sym = JSON.parse(a.symptoms || '[]'); return `<div class="list-item" style="align-items:flex-start">${avatar(a.patient_name, a.patient_hue)}<div class="grow"><div class="row wrap"><b>${esc(a.patient_name)}</b><span class="chip ${a.urgency === 'urgent' ? 'coral' : a.urgency === 'soon' ? 'amber' : 'gray'}">${a.urgency}</span><span class="tiny muted">${ago(a.created_at)}</span></div><div class="small" style="margin:3px 0">${esc(a.reason)}</div><div class="row wrap" style="gap:5px">${sym.map(s => `<span class="chip outline" style="padding:2px 8px">${s}</span>`).join('')}</div></div><div class="col" style="gap:6px"><button class="btn sm" data-accept="${a.id}">${I.check} Accept</button><a class="btn sm ghost" href="/appointments/${a.id}">Details</a></div></div>`; };
const bindQueue = draw => $$('[data-accept]').forEach(b => b.onclick = async () => { b.disabled = true; try { await api(`/appointments/${b.dataset.accept}/status`, { method: 'POST', body: { status: 'accepted' } }); toast('Accepted', 'Patient notified — start the call from the chart.', 'ok'); navigate('/appointments/' + b.dataset.accept); } catch (e) { toast('Error', e.message, 'err'); draw(); } });

route('/queue', async () => {
  if (!state.user) return navigate('/login', true);
  if (state.user.role !== 'doctor') return navigate('/appointments', true);
  shell('<div class="skeleton" style="height:300px"></div>', 'Queue');
  const draw = async () => {
    const { appointments } = await api('/appointments');
    const groups = [['requested', 'Waiting'], ['accepted', 'Accepted'], ['in_call', 'Live'], ['completed', 'Completed'], ['declined', 'Declined'], ['cancelled', 'Cancelled']];
    shell(`${pageHead('Consultation queue')}${groups.map(([st, label]) => { const list = appointments.filter(a => a.status === st); if (!list.length && !['requested', 'accepted'].includes(st)) return ''; return `<div class="card mb"><h3 class="mb">${label} <span class="muted">(${list.length})</span></h3>${list.length ? list.map(a => st === 'requested' ? queueRow(a) : `<a class="list-item" href="/appointments/${a.id}" style="color:inherit">${avatar(a.patient_name, a.patient_hue)}<div class="grow"><div class="row"><b>${esc(a.patient_name)}</b><span class="status ${a.status}">${statusLabel(a.status)}</span></div><div class="small muted">${esc(a.reason)}</div><div class="tiny muted">${ago(a.created_at)}${a.plan_code ? ' · Plan ' + a.plan_code : ''}</div></div>${['accepted', 'in_call'].includes(st) ? `<span class="btn sm">${I.video}</span>` : ''}</a>`).join('') : emptyState(I.cal, `Nothing ${label.toLowerCase()}.`)}</div>`; }).join('')}`, 'Queue');
    bindQueue(draw);
  };
  await draw();
  const offs = [onWS('appointment:new', draw), onWS('appointment:update', draw)];
  return () => offs.forEach(f => f());
});

// ---------- Care plan editor ----------
export function planEditor(a, plan, onSaved) {
  const d = { diagnosis: plan?.diagnosis || '', notes: plan?.notes || '', advice: plan?.advice || '', follow_up_days: plan?.follow_up_days || '', tests: plan ? [...plan.tests] : [], prescriptions: plan ? [...plan.prescriptions] : [] };
  modal(`<div class="row between"><h2>Care plan — ${esc(a.patient_name)}</h2><button class="btn icon ghost" data-close>${I.x}</button></div>
    ${a.patient_allergies ? `<div class="notice mt">${I.info}<span><b>Allergies:</b> ${esc(a.patient_allergies)}</span></div>` : ''}
    <div class="tabs mt"><button class="on" data-t="dx">Diagnosis</button><button data-t="rx">Prescriptions <span class="chip" id="rxN">${d.prescriptions.length}</span></button><button data-t="tests">Tests <span class="chip blue" id="txN">${d.tests.length}</span></button></div>
    <div data-p="dx" class="col">
      <div class="field"><label>Diagnosis / assessment</label><input class="input" id="dx" value="${esc(d.diagnosis)}" placeholder="e.g. Uncomplicated malaria"></div>
      <div class="field"><label>Clinical notes</label><textarea class="input" id="notes" placeholder="History, examination findings, plan…">${esc(d.notes)}</textarea></div>
      <div class="field"><label>Advice to patient</label><textarea class="input" id="advice" placeholder="Rest, fluids, when to return…">${esc(d.advice)}</textarea></div>
      <div class="field"><label>Follow-up in (days)</label><input class="input" id="fu" type="number" min="0" value="${d.follow_up_days}"></div></div>
    <div data-p="rx" class="col hidden">
      <div class="small muted">Quick add:</div><div class="row wrap">${COMMON_DRUGS.map((x, i) => `<button class="chip click" data-qd="${i}">${x[0]}</button>`).join('')}</div>
      <div id="rxList"></div>
      <div class="card" style="background:var(--g50);box-shadow:none"><b class="small">Add prescription</b><div class="form-grid mt"><input class="input" id="r_drug" placeholder="Drug name *"><input class="input" id="r_str" placeholder="Strength (e.g. 500 mg)"><input class="input" id="r_dose" placeholder="Dose (e.g. 1 tablet)"><input class="input" id="r_freq" placeholder="Frequency (e.g. twice daily)"><input class="input" id="r_dur" placeholder="Duration (e.g. 5 days)"><input class="input" id="r_qty" placeholder="Quantity"></div><input class="input mt" id="r_notes" placeholder="Instructions (e.g. after food)"><button class="btn sm mt" id="addRx">${I.plus} Add</button></div></div>
    <div data-p="tests" class="col hidden">
      <div class="small muted">Tap to add common tests:</div><div class="row wrap" id="quickTests">${COMMON_TESTS.map(t => `<button class="chip click" data-qt="${esc(t)}">${t}</button>`).join('')}</div>
      <div id="txList"></div>
      <div class="row"><input class="input grow" id="t_name" placeholder="Other test…"><button class="btn sm" id="addTx">${I.plus}</button></div></div>
    <div class="row mt2" style="justify-content:flex-end"><button class="btn ghost" data-close>Cancel</button><button class="btn" id="save">${I.check} Save & send to patient</button></div>`,
    {
      onMount: (bg, close) => {
        const q = s => bg.querySelector(s);
        $$('[data-t]', bg).forEach(b => b.onclick = () => { $$('[data-t]', bg).forEach(x => x.classList.toggle('on', x === b)); $$('[data-p]', bg).forEach(p => p.classList.toggle('hidden', p.dataset.p !== b.dataset.t)); });
        const drawRx = () => { q('#rxN').textContent = d.prescriptions.length; q('#rxList').innerHTML = d.prescriptions.map((p, i) => `<div class="rx-line"><div class="rx-ic">${I.pill}</div><div><b>${esc(p.drug)}</b> ${esc(p.strength || '')}<div class="small muted">${esc(p.dose)} · ${esc(p.frequency)} · ${esc(p.duration)} · Qty ${esc(p.qty || '—')}</div></div><button class="btn icon ghost" data-rmrx="${i}">${I.trash}</button></div>`).join('') || '<p class="small muted">No prescriptions yet.</p>'; $$('[data-rmrx]', bg).forEach(b => b.onclick = () => { d.prescriptions.splice(+b.dataset.rmrx, 1); drawRx(); }); };
        const drawTx = () => { q('#txN').textContent = d.tests.length; q('#txList').innerHTML = d.tests.map((t, i) => `<div class="rx-line"><div class="rx-ic lab">${I.flask}</div><div><b>${esc(t.name)}</b><label class="small muted row" style="gap:5px;margin-top:3px"><input type="checkbox" data-urg="${i}" ${t.urgent ? 'checked' : ''}> Urgent</label></div><button class="btn icon ghost" data-rmtx="${i}">${I.trash}</button></div>`).join('') || '<p class="small muted">No tests yet.</p>'; $$('[data-rmtx]', bg).forEach(b => b.onclick = () => { d.tests.splice(+b.dataset.rmtx, 1); drawTx(); }); $$('[data-urg]', bg).forEach(c => c.onchange = () => d.tests[+c.dataset.urg].urgent = c.checked); $$('[data-qt]', bg).forEach(b => b.classList.toggle('on', d.tests.some(t => t.name === b.dataset.qt))); };
        $$('[data-qd]', bg).forEach(b => b.onclick = () => { const [drug, strength, dose, frequency, duration, qty] = COMMON_DRUGS[+b.dataset.qd]; d.prescriptions.push({ drug, strength, dose, frequency, duration, qty, notes: '' }); drawRx(); });
        $$('[data-qt]', bg).forEach(b => b.onclick = () => { const n = b.dataset.qt; const i = d.tests.findIndex(t => t.name === n); i >= 0 ? d.tests.splice(i, 1) : d.tests.push({ name: n, urgent: false, notes: '' }); drawTx(); });
        q('#addRx').onclick = () => { const drug = q('#r_drug').value.trim(); if (!drug) return toast('Drug name required', '', 'err'); d.prescriptions.push({ drug, strength: q('#r_str').value, dose: q('#r_dose').value, frequency: q('#r_freq').value, duration: q('#r_dur').value, qty: q('#r_qty').value, notes: q('#r_notes').value }); ['#r_drug', '#r_str', '#r_dose', '#r_freq', '#r_dur', '#r_qty', '#r_notes'].forEach(s => q(s).value = ''); drawRx(); };
        q('#addTx').onclick = () => { const n = q('#t_name').value.trim(); if (!n) return; d.tests.push({ name: n, urgent: false }); q('#t_name').value = ''; drawTx(); };
        q('#save').onclick = async () => {
          q('#save').disabled = true;
          try { await api(`/appointments/${a.id}/plan`, { method: 'PUT', body: { diagnosis: q('#dx').value, notes: q('#notes').value, advice: q('#advice').value, follow_up_days: +q('#fu').value || null, tests: d.tests, prescriptions: d.prescriptions } }); toast('Care plan sent', 'The patient can now see it.', 'ok'); close(); onSaved && onSaved(); }
          catch (e) { toast('Error', e.message, 'err'); q('#save').disabled = false; }
        };
        drawRx(); drawTx();
      }
    });
}
