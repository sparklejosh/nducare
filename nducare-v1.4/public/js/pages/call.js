import { state, api, I, $, $$, esc, avatar, toast, navigate, route, onWS, send, connectWS, confirmBox } from '../core.js';

const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun1.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }] };
// Optional TURN (for strict NATs / mobile networks): set window.NC_TURN = { urls, username, credential } in config.js
if (window.NC_TURN) ICE.iceServers.push(window.NC_TURN);

route('/call/:room', async ({ params }) => {
  if (!state.user) return navigate('/login', true);
  const room = params.room;
  let appt; try { const { appointments } = await api('/appointments'); appt = appointments.find(a => a.room_code === room); } catch { }
  if (!appt) { toast('Room not found', '', 'err'); return navigate('/dashboard', true); }
  if (!['accepted', 'in_call'].includes(appt.status)) { toast('Call not available', appt.status === 'requested' ? 'The doctor has not accepted yet.' : 'This consultation is closed.', 'err'); return navigate('/appointments/' + appt.id, true); }
  const isDoc = state.user.role === 'doctor';
  if (!isDoc && !appt.paid) { toast('Payment required', 'Please pay the consultation fee to join.', 'err'); return navigate('/appointments/' + appt.id, true); }
  const otherName = isDoc ? appt.patient_name : appt.doctor_name, otherHue = isDoc ? appt.patient_hue : appt.doctor_hue;

  document.title = `Call with ${otherName} · NduCare`;
  document.getElementById('app').innerHTML = `<div class="call">
    <div class="stage">
      <div class="remote-wrap"><video id="remote" autoplay playsinline></video>
        <div class="placeholder" id="ph">${avatar(otherName, otherHue, 'lg')}<div><b style="font-size:1.1rem">${esc(otherName)}</b><div id="phs" style="opacity:.75;font-size:.9rem;margin-top:4px">Waiting to connect…</div></div></div></div>
      <div class="local-wrap" id="localWrap"><video id="local" autoplay playsinline muted></video></div>
      <div class="head"><div class="row"><span class="badge-dot on"></span><div><b>${esc(otherName)}</b><div class="tiny" style="opacity:.75">${isDoc ? 'Patient' : esc(appt.doctor_specialty)} · <span class="timer" id="timer">00:00</span></div></div></div>
        <div class="row"><span class="net" id="net" title="Connection quality"><i></i><i></i><i></i><i></i></span><span class="chip" style="background:rgba(255,255,255,.15);color:#fff" id="secure">${I.shield} Encrypted</span></div></div>
      <div class="controls">
        <button class="ctl" id="micBtn" title="Mute">${I.mic}</button>
        <button class="ctl" id="camBtn" title="Camera">${I.video}</button>
        <button class="ctl" id="flipBtn" title="Flip camera">${I.flip}</button>
        <button class="ctl" id="chatBtn" title="Chat">${I.chat}<span class="n hidden" id="chatN">0</span></button>
        ${isDoc ? `<button class="ctl" id="planBtn" title="Care plan">${I.pill}</button>` : `<button class="ctl" id="infoBtn" title="Visit details">${I.info}</button>`}
        <button class="ctl end" id="endBtn" title="End call">${I.phoneOff}</button></div>
      <div class="panel hidden" id="panel"><div class="ph"><h3 id="panelTitle">Chat</h3><button class="btn icon ghost" id="panelClose">${I.x}</button></div><div class="pb" id="panelBody"></div><div id="panelFoot"></div></div>
    </div></div>`;

  // ---- media ----
  let local, pc, polite = false, makingOffer = false, ignoreOffer = false, facing = 'user', connected = false, startTs = null, timerInt, statsInt, peerPresent = false;
  const remoteV = $('#remote'), localV = $('#local');
  const setPh = t => { $('#phs').textContent = t; };
  try {
    local = await navigator.mediaDevices.getUserMedia({ video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } }, audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: true } });
  } catch (e) {
    try { local = await navigator.mediaDevices.getUserMedia({ audio: true }); toast('Camera unavailable', 'Continuing with audio only.', 'err'); $('#camBtn').classList.add('off'); }
    catch { toast('No microphone/camera access', 'Allow permissions in your browser and retry.', 'err'); return navigate('/appointments/' + appt.id, true); }
  }
  localV.srcObject = local;

  const newPC = () => {
    pc = new RTCPeerConnection(ICE);
    local.getTracks().forEach(t => pc.addTrack(t, local));
    pc.ontrack = e => { if (remoteV.srcObject !== e.streams[0]) { remoteV.srcObject = e.streams[0]; } };
    pc.onicecandidate = e => e.candidate && send({ type: 'ice', candidate: e.candidate });
    pc.onnegotiationneeded = async () => { try { makingOffer = true; await pc.setLocalDescription(); send({ type: 'offer', sdp: pc.localDescription }); } catch (e) { console.warn(e); } finally { makingOffer = false; } };
    pc.onconnectionstatechange = () => {
      const s = pc.connectionState;
      if (s === 'connected') { connected = true; $('#ph').classList.add('hidden'); if (!startTs) { startTs = Date.now(); timerInt = setInterval(tick, 1000); } if (appt.status !== 'in_call') { api(`/appointments/${appt.id}/status`, { method: 'POST', body: { status: 'in_call' } }).catch(() => { }); appt.status = 'in_call'; } toast('Connected', `You're now on a secure call with ${otherName}`, 'ok'); }
      if (s === 'disconnected') { setPh('Connection interrupted — reconnecting…'); $('#ph').classList.remove('hidden'); }
      if (s === 'failed') { setPh('Connection failed. Retrying…'); $('#ph').classList.remove('hidden'); pc.restartIce(); }
    };
    pc.oniceconnectionstatechange = () => { if (pc.iceConnectionState === 'failed') pc.restartIce(); };
  };
  const tick = () => { const s = ~~((Date.now() - startTs) / 1000); $('#timer').textContent = `${String(~~(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };

  // ---- signaling (perfect negotiation pattern) ----
  const offs = [];
  offs.push(onWS('joined', m => { polite = m.polite; peerPresent = m.peers.length > 0; if (peerPresent) { setPh('Connecting…'); if (!pc) newPC(); } else { setPh(isDoc ? 'Ringing the patient…' : 'Waiting for the doctor to join…'); send({ type: 'ring', room }); } }));
  offs.push(onWS('peer-joined', m => { peerPresent = true; setPh(`${m.peer.name} joined — connecting…`); if (!pc) newPC(); }));
  offs.push(onWS('peer-left', () => { peerPresent = false; connected = false; $('#ph').classList.remove('hidden'); setPh(`${otherName} left the call`); remoteV.srcObject = null; if (pc) { pc.close(); pc = null; } }));
  offs.push(onWS('offer', async m => {
    if (!pc) newPC();
    const collision = makingOffer || pc.signalingState !== 'stable';
    ignoreOffer = !polite && collision; if (ignoreOffer) return;
    await pc.setRemoteDescription(m.sdp); await pc.setLocalDescription(); send({ type: 'answer', sdp: pc.localDescription });
  }));
  offs.push(onWS('answer', async m => { if (pc && pc.signalingState !== 'stable') await pc.setRemoteDescription(m.sdp); }));
  offs.push(onWS('ice', async m => { try { if (pc) await pc.addIceCandidate(m.candidate); } catch (e) { if (!ignoreOffer) console.warn(e); } }));
  offs.push(onWS('media-state', m => { if (m.video === false) { $('#ph').classList.remove('hidden'); setPh(`${otherName} turned off camera`); } else if (connected) $('#ph').classList.add('hidden'); if (m.audio === false) toast(`${otherName} muted`, '', ''); }));
  offs.push(onWS('hangup', () => { toast('Call ended', `${otherName} ended the call.`, ''); cleanup(); navigate('/appointments/' + appt.id, true); }));
  offs.push(onWS('chat', m => { if (m.room !== room) return; msgs.push(m); if (panelMode === 'chat') drawChat(); else { unread++; $('#chatN').textContent = unread; $('#chatN').classList.remove('hidden'); } }));
  offs.push(onWS('open', () => send({ type: 'join', room })));
  connectWS(); if (state.ws?.readyState === 1) send({ type: 'join', room });

  // ---- quality meter ----
  let lastBytes = 0, lastT = 0;
  statsInt = setInterval(async () => {
    if (!pc || pc.connectionState !== 'connected') return $$('#net i').forEach(i => i.classList.remove('on'));
    const st = await pc.getStats(); let rtt = 0, loss = 0, bytes = 0;
    st.forEach(r => { if (r.type === 'candidate-pair' && r.state === 'succeeded' && r.currentRoundTripTime != null) rtt = r.currentRoundTripTime * 1000; if (r.type === 'inbound-rtp' && r.kind === 'video') { loss = r.packetsLost / Math.max(1, r.packetsReceived + r.packetsLost); bytes = r.bytesReceived; } });
    const kbps = lastT ? ((bytes - lastBytes) * 8 / ((Date.now() - lastT) / 1000)) / 1000 : 0; lastBytes = bytes; lastT = Date.now();
    const bars = rtt > 600 || loss > .1 ? 1 : rtt > 300 || loss > .05 ? 2 : rtt > 150 ? 3 : 4;
    $$('#net i').forEach((i, k) => i.classList.toggle('on', k < bars)); $('#net').title = `RTT ${Math.round(rtt)} ms · loss ${(loss * 100).toFixed(1)}% · ${Math.round(kbps)} kbps`;
  }, 2000);

  // ---- controls ----
  let micOn = true, camOn = local.getVideoTracks().length > 0;
  $('#micBtn').onclick = () => { micOn = !micOn; local.getAudioTracks().forEach(t => t.enabled = micOn); $('#micBtn').classList.toggle('off', !micOn); $('#micBtn').innerHTML = micOn ? I.mic : I.micOff; send({ type: 'media-state', audio: micOn }); };
  $('#camBtn').onclick = () => { if (!local.getVideoTracks().length) return; camOn = !camOn; local.getVideoTracks().forEach(t => t.enabled = camOn); $('#camBtn').classList.toggle('off', !camOn); $('#camBtn').innerHTML = camOn ? I.video : I.videoOff; send({ type: 'media-state', video: camOn }); };
  $('#flipBtn').onclick = async () => {
    facing = facing === 'user' ? 'environment' : 'user';
    try { const ns = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { exact: facing } } }); const nt = ns.getVideoTracks()[0]; const ot = local.getVideoTracks()[0]; pc?.getSenders().find(s => s.track?.kind === 'video')?.replaceTrack(nt); ot?.stop(); local.removeTrack(ot); local.addTrack(nt); localV.srcObject = local; localV.style.transform = facing === 'user' ? '' : 'scaleX(1)'; } catch { facing = facing === 'user' ? 'environment' : 'user'; toast('Only one camera found', '', ''); }
  };
  $('#endBtn').onclick = async () => {
    const end = await confirmBox('End call?', isDoc ? 'The consultation will be marked completed. You can still edit the care plan from the chart afterwards.' : 'Your doctor will send your care plan to the app.', 'End call', true);
    if (!end) return; send({ type: 'hangup' });
    if (isDoc && appt.status === 'in_call') { try { await api(`/appointments/${appt.id}/status`, { method: 'POST', body: { status: 'completed' } }); } catch { } }
    cleanup(); navigate('/appointments/' + appt.id, true);
  };
  // draggable PiP
  const lw = $('#localWrap'); let drag = null;
  lw.addEventListener('pointerdown', e => { drag = { x: e.clientX - lw.offsetLeft, y: e.clientY - lw.offsetTop }; lw.setPointerCapture(e.pointerId); });
  lw.addEventListener('pointermove', e => { if (!drag) return; lw.style.left = Math.max(0, Math.min(innerWidth - lw.offsetWidth, e.clientX - drag.x)) + 'px'; lw.style.top = Math.max(0, Math.min(innerHeight - lw.offsetHeight, e.clientY - drag.y)) + 'px'; lw.style.right = 'auto'; });
  lw.addEventListener('pointerup', () => drag = null);

  // ---- side panel: chat / info / plan ----
  let panelMode = null, unread = 0; let msgs = [];
  try { msgs = (await api(`/rooms/${room}/messages`)).messages; } catch { }
  const openPanel = mode => { panelMode = mode; $('#panel').classList.remove('hidden'); if (mode === 'chat') { unread = 0; $('#chatN').classList.add('hidden'); $('#panelTitle').textContent = 'Chat'; drawChat(); } else if (mode === 'info') { $('#panelTitle').textContent = 'Visit details'; drawInfo(); } else { $('#panelTitle').textContent = 'Care plan'; drawPlan(); } };
  $('#panelClose').onclick = () => { panelMode = null; $('#panel').classList.add('hidden'); };
  $('#chatBtn').onclick = () => panelMode === 'chat' ? $('#panelClose').click() : openPanel('chat');
  $('#infoBtn') && ($('#infoBtn').onclick = () => openPanel('info'));
  $('#planBtn') && ($('#planBtn').onclick = () => openPanel('plan'));
  const drawChat = () => {
    $('#panelBody').innerHTML = `<div class="chat-msgs">${msgs.length ? msgs.map(m => `<div class="bubble ${m.sender_id === state.user.id ? 'me' : ''}">${esc(m.body)}<div class="t">${new Date(m.created_at).toLocaleTimeString('en-NG', { timeStyle: 'short' })}</div></div>`).join('') : '<p class="small muted" style="text-align:center">Messages are saved to this consultation.</p>'}</div>`;
    $('#panelBody').scrollTop = 1e6;
    $('#panelFoot').innerHTML = `<form class="row" style="padding:10px 12px;border-top:1px solid var(--line)" id="cf"><input class="input grow" id="ci" placeholder="Type a message…" autocomplete="off"><button class="btn">Send</button></form>`;
    $('#cf').onsubmit = e => { e.preventDefault(); const v = $('#ci').value.trim(); if (!v) return; send({ type: 'chat', room, body: v }); $('#ci').value = ''; };
    $('#ci').focus();
  };
  const drawInfo = () => { const sym = JSON.parse(appt.symptoms || '[]'); $('#panelFoot').innerHTML = ''; $('#panelBody').innerHTML = `<div class="col"><div><div class="small muted">Doctor</div><b>${esc(appt.doctor_name)}</b> · ${esc(appt.doctor_specialty)}<div class="small muted">${esc(appt.doctor_mdcn)}</div></div><div><div class="small muted">Your reason</div>${esc(appt.reason)}</div><div class="row wrap">${sym.map(s => `<span class="chip">${s}</span>`).join('')}</div><div class="notice info">${I.info}<span>Your care plan (prescriptions & tests) will appear under this visit once the doctor writes it.</span></div></div>`; };
  const drawPlan = async () => {
    const { appointment: a, plan } = await api('/appointments/' + appt.id);
    const sym = JSON.parse(a.symptoms || '[]');
    $('#panelFoot').innerHTML = '';
    $('#panelBody').innerHTML = `<div class="col">
      <div class="card" style="background:var(--g50);box-shadow:none;padding:12px"><b>${esc(a.patient_name)}</b> <span class="small muted">${a.patient_gender || ''} ${a.patient_dob ? '· ' + Math.floor((Date.now() - new Date(a.patient_dob)) / 3.15576e10) + ' yrs' : ''}</span><div class="row wrap small mt" style="margin-top:6px"><span class="chip outline">Blood: ${esc(a.patient_blood || '—')}</span><span class="chip ${a.patient_allergies ? 'coral' : 'outline'}">Allergies: ${esc(a.patient_allergies || 'none')}</span></div><p class="small mt" style="margin-top:8px">${esc(a.reason)}</p><div class="row wrap mt" style="margin-top:6px;gap:4px">${sym.map(s => `<span class="chip outline" style="padding:2px 8px">${s}</span>`).join('')}</div></div>
      ${plan ? `<div><b>Diagnosis:</b> ${esc(plan.diagnosis || '—')}</div><div class="small">${plan.prescriptions.length} prescription(s) · ${plan.tests.length} test(s)</div><span class="chip mono">${plan.code}</span>` : '<p class="small muted">No care plan yet.</p>'}
      <button class="btn" id="editPlanBtn">${plan ? 'Edit care plan' : I.plus + ' Write care plan'}</button></div>`;
    $('#editPlanBtn').onclick = async () => { const { planEditor } = await import('./doctor.js'); planEditor(a, plan, drawPlan); };
  };

  // ---- cleanup ----
  const cleanup = () => { clearInterval(timerInt); clearInterval(statsInt); send({ type: 'leave' }); offs.forEach(f => f()); try { pc?.close(); } catch { } local?.getTracks().forEach(t => t.stop()); window.removeEventListener('beforeunload', bu); };
  const bu = () => { send({ type: 'leave' }); };
  window.addEventListener('beforeunload', bu);
  // keep screen awake
  let wl; try { wl = await navigator.wakeLock?.request('screen'); } catch { }
  return () => { cleanup(); wl?.release?.(); };
});
