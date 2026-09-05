import { state, I, $, $$, esc, avatar, logout, current } from './core.js';

const nav = (u) => u.role === 'doctor' ? [
  ['/dashboard', I.home, 'Dashboard'], ['/queue', I.cal, 'Queue'], ['/map', I.map, 'Facilities'], ['/profile', I.user, 'Profile']
] : [
  ['/dashboard', I.home, 'Home'], ['/doctors', I.steth, 'Doctors'], ['/appointments', I.cal, 'Visits'], ['/map', I.map, 'Nearby'], ['/profile', I.user, 'Profile']
];

export const logo = (light) => `<a href="/" class="logo" style="${light ? 'color:#fff' : ''}"><span class="mark"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><path d="M22 12h-2.48a2 2 0 0 0-1.93 1.46l-2.35 8.36a.25.25 0 0 1-.48 0L9.24 2.18a.25.25 0 0 0-.48 0l-2.35 8.36A2 2 0 0 1 4.49 12H2"/></svg></span>NduCare</a>`;

export function shell(content, title = '') {
  const u = state.user;
  const items = nav(u);
  const active = p => current.path === p || (p !== '/dashboard' && current.path.startsWith(p)) ? 'active' : '';
  document.getElementById('app').innerHTML = `
  <div class="shell">
    <aside class="sidebar">
      <div class="brand">${logo(true)}</div>
      ${items.map(([h, ic, l]) => `<a class="nav ${active(h)}" href="${h}">${ic}<span>${l}</span></a>`).join('')}
      <a class="nav" href="/verify">${I.shield}<span>Verify Rx</span></a>
      <div class="me">${avatar(u.name, u.avatar_hue, 'sm')}<div class="grow"><div style="font-weight:700;font-size:.9rem;color:#fff;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${esc(u.name)}</div><div class="tiny" style="opacity:.7">${u.role === 'doctor' ? esc(u.specialty || 'Doctor') : 'Patient'}</div></div><button class="btn icon ghost" id="logoutBtn" title="Sign out" style="color:#b9e7d3;box-shadow:none;width:36px;height:36px">${I.logout}</button></div>
    </aside>
    <div>
      <div class="topbar">${logo(true)}<div class="row">${avatar(u.name, u.avatar_hue, 'sm')}</div></div>
      <main class="main">${content}</main>
    </div>
    <nav class="bottomnav">${items.map(([h, ic, l]) => `<a class="${active(h)}" href="${h}">${ic}<span>${l}</span></a>`).join('')}</nav>
  </div>`;
  $('#logoutBtn').onclick = logout;
  document.title = title ? `${title} · NduCare` : 'NduCare';
}

export const pageHead = (title, sub = '', right = '') => `<div class="row between wrap mb" style="margin-bottom:20px"><div><h1>${title}</h1>${sub ? `<p class="muted mt" style="margin-top:4px">${sub}</p>` : ''}</div>${right}</div>`;
export const emptyState = (icon, text, cta = '') => `<div class="empty">${icon}<p>${text}</p>${cta}</div>`;
