// dashboard/public-user/js/app.js
// Router, shell state, and shared UI helpers for the public community hub.

window.AppState = { user: null, authenticated: false };

const PAGE_TITLES = {
  overview: 'Übersicht',
  server: 'Server',
  community: 'Community',
  statistik: 'Statistik',
  rules: 'Regeln',
  events: 'Events',
  changelog: 'Changelog',
  tickets: 'Support',
};

function toast(message, level = 'info', durationMs = 3500) {
  const container = document.getElementById('toast-container');
  if (!container) return;
  const el = document.createElement('div');
  el.className = `toast ${level}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}
window.toast = toast;

function escapeHtml(s) {
  return String(s ?? '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
window.escapeHtml = escapeHtml;

function fmt(n) {
  if (n == null) return '-';
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'k';
  return String(n);
}
window.fmt = fmt;

function fmtDate(ts) {
  if (!ts) return '-';
  return new Date(ts * 1000).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}
window.fmtDate = fmtDate;

function fmtDuration(seconds) {
  const secs = Math.max(0, Number(seconds ?? 0));
  if (secs < 3600) return `${Math.round(secs / 60)} min`;
  return `${(secs / 3600).toFixed(1)} h`;
}
window.fmtDuration = fmtDuration;

function emptyState(message = 'Noch keine Daten vorhanden.', detail = '') {
  return `
    <div class="empty-state public-empty">
      <div class="empty-icon">S13</div>
      <p>${escapeHtml(message)}</p>
      ${detail ? `<span>${escapeHtml(detail)}</span>` : ''}
    </div>
  `;
}
window.emptyState = emptyState;

function loadingState() {
  return `<div class="card"><div class="skeleton" style="height:220px"></div></div>`;
}
window.loadingState = loadingState;

function errorState() {
  return emptyState('Der Public Hub konnte diese Daten gerade nicht laden.', 'Bitte versuche es gleich erneut.');
}
window.errorState = errorState;

function statusBadge(online) {
  return `<span class="badge ${online ? 'badge-online' : 'badge-offline'}">${online ? 'Online' : 'Offline'}</span>`;
}
window.statusBadge = statusBadge;

function pageHeader(kicker, title, text) {
  return `
    <div class="page-header public-page-header">
      <div class="kicker">${escapeHtml(kicker)}</div>
      <h1>${escapeHtml(title)}</h1>
      <p>${escapeHtml(text)}</p>
    </div>
  `;
}
window.pageHeader = pageHeader;

function statCard(label, value, sub = '', tone = '') {
  return `
    <div class="stat-card ${escapeHtml(tone)}">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${escapeHtml(value)}</div>
      ${sub ? `<div class="stat-sub">${escapeHtml(sub)}</div>` : ''}
    </div>
  `;
}
window.statCard = statCard;

function loginPrompt(message = 'Melde dich mit Discord an, um deinen persönlichen Bereich zu sehen.') {
  return `
    <div class="card login-prompt">
      <div>
        <div class="card-title">Login erforderlich</div>
        <p>${escapeHtml(message)}</p>
      </div>
      <a class="btn btn-primary" href="/auth/public/login">Mit Discord anmelden</a>
    </div>
  `;
}
window.loginPrompt = loginPrompt;

function periodBar(current, onChange) {
  const periods = ['24h','7d','30d','90d','all'];
  const div = document.createElement('div');
  div.className = 'period-bar';
  div.innerHTML = periods.map(p => `<button class="period-btn${p === current ? ' active' : ''}" data-period="${p}">${p}</button>`).join('');
  div.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      div.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === btn.dataset.period));
      onChange(btn.dataset.period);
    });
  });
  return div;
}
window.periodBar = periodBar;

const loadedScripts = new Set();

function loadScript(src) {
  if (loadedScripts.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload = () => { loadedScripts.add(src); resolve(); };
    s.onerror = () => reject(new Error(`Script ${src} konnte nicht geladen werden`));
    document.head.appendChild(s);
  });
}

async function navigateTo(page) {
  if (!Object.prototype.hasOwnProperty.call(PAGE_TITLES, page)) page = 'overview';
  document.querySelectorAll('.nav-item').forEach(el => el.classList.toggle('active', el.dataset.page === page));
  document.getElementById('page-title').textContent = PAGE_TITLES[page];
  document.title = `${PAGE_TITLES[page]} - SECTOR 13`;
  if (window.location.hash !== '#/' + page) history.pushState(null, '', '#/' + page);

  const content = document.getElementById('page-content');
  content.innerHTML = loadingState();

  try {
    const moduleId = 'page-' + page;
    if (!window[moduleId]) await loadScript(`/public/js/pages/${page}.js`);
    const pageModule = window[moduleId];
    if (pageModule?.render) await pageModule.render(content);
    else content.innerHTML = emptyState('Seite nicht gefunden.');
  } catch {
    content.innerHTML = errorState();
  }
}
window.navigateTo = navigateTo;

document.getElementById('sidebar-nav').addEventListener('click', (e) => {
  const item = e.target.closest('.nav-item');
  if (item?.dataset.page) navigateTo(item.dataset.page);
});

(function setupMobileSidebar() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar = document.getElementById('sidebar');
  const overlay = document.getElementById('sidebar-overlay');
  if (!toggleBtn || !sidebar) return;

  function closeSidebar() {
    sidebar.classList.remove('open');
    overlay?.classList.remove('visible');
  }

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.toggle('open');
    overlay?.classList.toggle('visible', sidebar.classList.contains('open'));
  });
  overlay?.addEventListener('click', closeSidebar);
  document.getElementById('sidebar-nav').addEventListener('click', (e) => {
    if (e.target.closest('.nav-item') && window.innerWidth <= 768) closeSidebar();
  });
})();

window.addEventListener('hashchange', () => {
  navigateTo(window.location.hash.replace('#/', '') || 'overview');
});

async function init() {
  const loginLink = document.getElementById('login-link');
  const logoutLink = document.getElementById('logout-link');
  const userName = document.getElementById('user-name');
  const avatarEl = document.getElementById('user-avatar');

  try {
    const result = await API.me();
    if (result.success && result.data) {
      const user = result.data;
      window.AppState.user = user;
      window.AppState.authenticated = true;
      userName.textContent = user.username;
      if (user.avatar && avatarEl) {
        avatarEl.src = `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.userId)}/${encodeURIComponent(user.avatar)}.png?size=64`;
      }
      loginLink?.classList.add('hidden');
      logoutLink?.classList.remove('hidden');
    }
  } catch {
    window.AppState.user = null;
    window.AppState.authenticated = false;
  }

  await navigateTo(window.location.hash.replace('#/', '') || 'overview');
}

init();
