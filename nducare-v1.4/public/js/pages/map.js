import { state, api, I, $, $$, esc, toast, navigate, route, locate, userLoc, km, mins, stars } from '../core.js';
import { shell, pageHead } from '../layout.js';
import { logo } from '../layout.js';

let leafletReady;
function loadLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletReady) return leafletReady;
  return leafletReady = new Promise((res, rej) => {
    const css = document.createElement('link'); css.rel = 'stylesheet'; css.href = '/vendor/leaflet/leaflet.css'; document.head.appendChild(css);
    const s = document.createElement('script'); s.src = '/vendor/leaflet/leaflet.js'; s.onload = res; s.onerror = rej; document.head.appendChild(s);
  });
}
const pinHtml = (type, on) => `<div class="pin ${type} ${on ? 'on' : ''}">${type === 'lab' ? I.flask : type === 'pharmacy' ? I.pill : I.user}</div>`;
const stepIcon = s => /left/.test(s.modifier || '') ? I.back : /right/.test(s.modifier || '') ? I.back.replace('<svg', '<svg style="transform:rotate(180deg)"') : s.type === 'arrive' ? I.pin : I.nav;

route('/map', async ({ query }) => {
  const type0 = query.get('type') === 'lab' ? 'lab' : query.get('type') === 'pharmacy' ? 'pharmacy' : '';
  const planId = query.get('plan');
  let type = type0, needs = [], planLabel = '', facilities = [], selected = null, routeLayer = null, mode = 'driving', q = '';

  // Needs from a care plan (tests → labs; prescriptions → any pharmacy)
  if (planId && state.user) {
    try { const { plan } = await api('/appointments/' + planId); if (plan) { if (type === 'lab' && plan.tests.length) { needs = plan.tests.map(t => t.name); planLabel = `Labs that run: ${needs.join(', ')}`; } if (type === 'pharmacy' && plan.prescriptions.length) { planLabel = `Pharmacies for ${plan.prescriptions.length} prescribed item(s) · code ${plan.code}`; needs = ['Prescription dispensing']; } } } catch { }
  }

  const content = `<div class="map-page">
    <div class="side">
      <div class="row between wrap" style="gap:8px"><div><h1 style="font-size:1.35rem">Nearby facilities</h1><div class="tiny muted" id="locLbl">${state.loc ? 'Using your location' : 'Using Enugu centre — tap locate'}</div></div><div class="row"><button class="btn icon soft" id="locBtn" title="Use my location">${I.locate}</button></div></div>
      <div class="seg" style="display:flex"><button data-type="" class="grow ${!type ? 'on' : ''}">All</button><button data-type="lab" class="grow ${type === 'lab' ? 'on' : ''}">${I.flask.replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')} Labs</button><button data-type="pharmacy" class="grow ${type === 'pharmacy' ? 'on' : ''}">${I.pill.replace('<svg', '<svg width="14" height="14" style="vertical-align:-2px"')} Pharmacies</button></div>
      <div style="position:relative"><input class="input" id="q" placeholder="Search name, area or address…" style="padding-left:38px"><span style="position:absolute;left:11px;top:11px;width:18px;color:var(--ink-3)">${I.search}</span></div>
      ${planLabel ? `<div class="notice ok small">${I.check}<span>${esc(planLabel)}. Best matches first.</span></div>` : ''}
      <div id="dir" class="hidden"></div>
      <div id="list" class="col" style="gap:8px"><div class="skeleton" style="height:80px"></div><div class="skeleton" style="height:80px"></div></div>
    </div>
    <div id="map"></div></div>`;
  if (state.user) shell(content, 'Nearby'); else document.getElementById('app').innerHTML = `<div style="padding:14px"><div class="row between mb">${logo()}<a class="btn sm" href="/login">Sign in</a></div>${content}</div>`;

  await loadLeaflet();
  const L = window.L;
  const start = userLoc();
  const map = L.map('map', { zoomControl: false }).setView([start.lat, start.lng], 13);
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19, attribution: '© <a href="https://openstreetmap.org/copyright">OpenStreetMap</a> contributors' }).addTo(map);
  const markers = L.layerGroup().addTo(map);
  let meMarker = L.marker([start.lat, start.lng], { icon: L.divIcon({ className: '', html: pinHtml('me'), iconSize: [30, 30], iconAnchor: [15, 15] }), zIndexOffset: 1000 }).addTo(map).bindPopup(state.loc ? 'You are here' : 'Enugu city centre (approximate)');
  let accCircle = state.loc?.acc ? L.circle([start.lat, start.lng], { radius: state.loc.acc, color: '#f2634e', weight: 1, fillOpacity: .08 }).addTo(map) : null;
  const mk = {};

  const load = async () => {
    const l = userLoc();
    const p = new URLSearchParams({ lat: l.lat, lng: l.lng, limit: 60 }); if (type) p.set('type', type); if (q) p.set('q', q); if (needs.length) p.set('service', needs.join('|'));
    ({ facilities } = await api('/facilities?' + p));
    drawList(); drawMarkers();
  };
  const drawMarkers = () => {
    markers.clearLayers();
    facilities.forEach(f => { const m = L.marker([f.lat, f.lng], { icon: L.divIcon({ className: '', html: pinHtml(f.type, selected?.id === f.id), iconSize: [30, 30], iconAnchor: [15, 30], popupAnchor: [0, -28] }) }).addTo(markers); m.on('click', () => select(f, false)); mk[f.id] = m; });
    if (!selected && facilities.length) { const b = L.latLngBounds(facilities.slice(0, 8).map(f => [f.lat, f.lng])); b.extend(meMarker.getLatLng()); map.fitBounds(b, { padding: [40, 40], maxZoom: 15 }); }
  };
  const drawList = () => {
    $('#list').innerHTML = facilities.length ? facilities.map(f => `<div class="fac ${selected?.id === f.id ? 'on' : ''}" data-id="${f.id}">
      <div class="row between" style="align-items:flex-start"><div class="grow"><div class="row" style="gap:6px"><span class="chip ${f.type === 'lab' ? 'blue' : ''}" style="padding:2px 8px">${f.type === 'lab' ? 'Lab' : 'Pharmacy'}</span>${needs.length && f.matches ? `<span class="chip ${f.matches === needs.length ? '' : 'amber'}" style="padding:2px 8px">${f.matches}/${needs.length} matched</span>` : ''}</div><b style="display:block;margin-top:5px">${esc(f.name)}</b><div class="small muted">${esc(f.address)}</div></div><div style="text-align:right"><div class="d">${f.distance_km != null ? f.distance_km + ' km' : ''}</div><div class="tiny muted">${esc(f.accreditation)}</div></div></div>
      <div class="row between small mt" style="margin-top:8px"><span class="stars">${stars(f.rating)}</span> <span class="muted">${esc(f.hours || '')}</span></div></div>`).join('') : '<div class="empty">No facilities match. Try another filter.</div>';
    $$('.fac').forEach(el => el.onclick = () => select(facilities.find(f => f.id === +el.dataset.id), true));
  };
  const select = async (f, pan) => {
    selected = f; drawList(); drawMarkers();
    if (pan) map.flyTo([f.lat, f.lng], 16, { duration: .6 });
    const missing = needs.filter(n => !f.services.some(s => s.toLowerCase().includes(n.toLowerCase()) || n.toLowerCase().includes(s.toLowerCase())));
    mk[f.id]?.bindPopup(`<div style="min-width:220px"><b>${esc(f.name)}</b><div class="small muted">${esc(f.address)}</div>${f.phone ? `<div class="small mt">📞 <a href="tel:${f.phone.replace(/\s/g, '')}">${esc(f.phone)}</a></div>` : ''}<div class="row wrap mt" style="gap:4px">${f.services.slice(0, 6).map(s => `<span class="chip outline" style="padding:2px 7px;font-size:.7rem">${esc(s)}</span>`).join('')}${f.services.length > 6 ? `<span class="tiny muted">+${f.services.length - 6} more</span>` : ''}</div>${missing.length ? `<div class="tiny mt" style="color:#b0331f">Not listed here: ${esc(missing.join(', '))}</div>` : ''}<button class="btn sm block mt" id="goBtn">${I.nav} Directions</button></div>`).openPopup();
    setTimeout(() => { $('#goBtn') && ($('#goBtn').onclick = () => directions(f)); }, 50);
    document.querySelector(`.fac[data-id="${f.id}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  };
  const directions = async (f) => {
    const l = userLoc(); const box = $('#dir'); box.classList.remove('hidden');
    box.innerHTML = `<div class="card" style="padding:14px"><div class="row between"><b>Directions</b><button class="btn icon ghost" id="dirClose" style="width:34px;height:34px">${I.x}</button></div><div class="skeleton mt" style="height:60px"></div></div>`;
    $('#dirClose').onclick = () => { box.classList.add('hidden'); routeLayer && map.removeLayer(routeLayer); routeLayer = null; };
    try {
      const r = await api(`/route?from=${l.lat},${l.lng}&to=${f.lat},${f.lng}&mode=${mode}`);
      routeLayer && map.removeLayer(routeLayer);
      routeLayer = L.layerGroup([L.polyline(r.coords, { color: '#fff', weight: 9, opacity: .9 }), L.polyline(r.coords, { color: '#1554c8', weight: 5, opacity: .95 })]).addTo(map);
      map.fitBounds(L.polyline(r.coords).getBounds(), { padding: [50, 50] });
      const gmaps = `https://www.google.com/maps/dir/?api=1&origin=${l.lat},${l.lng}&destination=${f.lat},${f.lng}&travelmode=${mode}`;
      box.innerHTML = `<div class="card" style="padding:14px"><div class="row between"><div><b>${esc(f.name)}</b><div class="small muted">${km(r.distance_m)} · ${mins(r.duration_s)} ${mode === 'walking' ? 'walk' : 'drive'}${r.fallback ? ' (estimate)' : ''}</div></div><button class="btn icon ghost" id="dirClose" style="width:34px;height:34px">${I.x}</button></div>
        <div class="row mt"><div class="seg"><button data-m="driving" class="${mode === 'driving' ? 'on' : ''}">${I.car.replace('<svg', '<svg width="15" height="15" style="vertical-align:-3px"')} Drive</button><button data-m="walking" class="${mode === 'walking' ? 'on' : ''}">${I.walk.replace('<svg', '<svg width="15" height="15" style="vertical-align:-3px"')} Walk</button></div><a class="btn sm ghost" href="${gmaps}" target="_blank" rel="noopener">Open in Google Maps</a></div>
        ${f.phone ? `<a class="btn sm soft mt" href="tel:${f.phone.replace(/\s/g, '')}">${I.phone} Call ${esc(f.phone)}</a>` : ''}
        <div class="dir-steps mt">${r.steps.map(s => `<div class="dir-step"><span class="ic">${stepIcon(s)}</span><span>${esc(s.instruction)}</span><span class="tiny muted">${s.distance_m > 0 ? km(s.distance_m) : ''}</span></div>`).join('')}</div></div>`;
      $('#dirClose').onclick = () => { box.classList.add('hidden'); routeLayer && map.removeLayer(routeLayer); routeLayer = null; };
      $$('[data-m]').forEach(b => b.onclick = () => { mode = b.dataset.m; directions(f); });
      box.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (e) { box.innerHTML = `<div class="notice">${I.info}<span>Could not fetch a route: ${esc(e.message)}</span></div>`; }
  };

  $$('[data-type]').forEach(b => b.onclick = () => { type = b.dataset.type; $$('[data-type]').forEach(x => x.classList.toggle('on', x === b)); if (type !== type0) { needs = []; $('.notice.ok')?.remove(); } selected = null; load(); });
  let t; $('#q').oninput = e => { clearTimeout(t); t = setTimeout(() => { q = e.target.value.trim(); load(); }, 250); };
  $('#locBtn').onclick = async () => {
    $('#locBtn').disabled = true; const l = await locate(); $('#locBtn').disabled = false;
    if (l) { meMarker.setLatLng([l.lat, l.lng]).bindPopup('You are here'); accCircle && map.removeLayer(accCircle); accCircle = L.circle([l.lat, l.lng], { radius: l.acc || 30, color: '#f2634e', weight: 1, fillOpacity: .08 }).addTo(map); $('#locLbl').textContent = `Your location (±${Math.round(l.acc || 0)} m)`; map.flyTo([l.lat, l.lng], 14); selected = null; load(); }
  };
  // allow user to set location by long-press / right click when GPS is off
  map.on('contextmenu', e => { state.loc = { lat: e.latlng.lat, lng: e.latlng.lng, acc: 0 }; localStorage.setItem('nc_loc', JSON.stringify(state.loc)); meMarker.setLatLng(e.latlng); $('#locLbl').textContent = 'Location set manually'; toast('Location set', 'Distances updated from this point.', 'ok'); load(); });

  await load();
  if (!state.loc) locate({ silent: true }).then(l => l && $('#locBtn').click());
  return () => { map.remove(); };
});
