// dashboard/public/js/app.js
// Router, navigation, auth check, toast notifications, global state.

// ── Global state ──────────────────────────────────────────────────────────────
window.AppState = { user: null };

// ── Page titles ───────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  'overview':          'Overview',
  'analytics-messages':'Nachrichten Analytics',
  'analytics-voice':   'Voice & Stream Analytics',
  'analytics-tickets': 'Ticket Analytics',
  'analytics-growth':  'Wachstum Analytics',
  'analytics-ai':      'AI Usage Analytics',
  'analytics-status':  'Serverstatus Analytics',
  'tickets':           'Ticket-Verwaltung',
  'members':           'Mitglieder',
  'server-status':     'Server Status',
  'logs':              'Logs',
  'ai':                'AI',
  'settings':          'Einstellungen',
};

// ── Toast ─────────────────────────────────────────────────────────────────────
function toast(message, level = 'info', durationMs = 3500) {
  const container = document.getElementById('toast-container');
  const el = document.createElement('div');
  el.className = `toast ${level}`;
  el.textContent = message;
  container.appendChild(el);
  setTimeout(() => el.remove(), durationMs);
}
window.toast = toast;

// ── Empty / Loading state helpers ─────────────────────────────────────────────
function emptyState(message = 'Noch keine Daten vorhanden.') {
  return `<div class="empty-state"><div class="empty-icon">◌</div><p>${message}</p></div>`;
}
function loadingState() {
  return `<div class="card"><div class="skeleton" style="height:200px"></div></div>`;
}
function errorState(err) {
  return `<div class="empty-state"><div class="empty-icon" style="color:var(--offline)">✕</div><p>Fehler: ${err}</p></div>`;
}
window.emptyState = emptyState;
window.loadingState = loadingState;
window.errorState = errorState;

// ── Number formatting ─────────────────────────────────────────────────────────
function fmt(n) {
  if (n == null) return '—';
  if (n >= 1_000_000) return (n/1_000_000).toFixed(1) + 'M';
  if (n >= 1_000)     return (n/1_000).toFixed(1) + 'k';
  return String(n);
}
window.fmt = fmt;

function fmtDate(ts) {
  if (!ts) return '—';
  return new Date(ts * 1000).toLocaleString('de-DE', { day:'2-digit', month:'2-digit', year:'2-digit', hour:'2-digit', minute:'2-digit' });
}
window.fmtDate = fmtDate;

function fmtUptime(secs) {
  if (!secs) return '—';
  const d = Math.floor(secs / 86400);
  const h = Math.floor((secs % 86400) / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (d > 0) return `${d}d ${h}h`;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}
window.fmtUptime = fmtUptime;

// ── Navigation ────────────────────────────────────────────────────────────────
async function navigateTo(page) {
  // Update active nav item
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });

  // Update page title
  document.getElementById('page-title').textContent = PAGE_TITLES[page] ?? page;
  document.title = `${PAGE_TITLES[page] ?? page} — SECTOR 13`;

  // Update URL hash without triggering hashchange
  history.pushState(null, '', '#/' + page);

  // Load page module
  const content = document.getElementById('page-content');
  content.innerHTML = loadingState();

  try {
    // Dynamically load the page script if not already loaded
    const moduleId = 'page-' + page;
    if (!window[moduleId]) {
      await loadScript(`/js/pages/${page}.js`);
    }
    const pageModule = window[moduleId];
    if (pageModule?.render) {
      await pageModule.render(content);
    } else {
      content.innerHTML = emptyState(`Seite "${page}" nicht gefunden.`);
    }
  } catch (err) {
    content.innerHTML = errorState(err.message);
  }
}

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
    const s = document.createElement('script');
    s.src = src;
    s.onload  = resolve;
    s.onerror = () => reject(new Error(`Script ${src} konnte nicht geladen werden`));
    document.head.appendChild(s);
  });
}

// ── Period selector helper ────────────────────────────────────────────────────
function periodBar(current, onChange) {
  const periods = ['24h','7d','30d','90d','all'];
  const html = `<div class="period-bar">${periods.map(p =>
    `<button class="period-btn${p===current?' active':''}" data-period="${p}">${p}</button>`
  ).join('')}</div>`;
  const div = document.createElement('div');
  div.innerHTML = html;
  div.querySelectorAll('.period-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      div.querySelectorAll('.period-btn').forEach(b => b.classList.toggle('active', b.dataset.period === btn.dataset.period));
      onChange(btn.dataset.period);
    });
  });
  return div;
}
window.periodBar = periodBar;

// ── Sidebar event delegation ──────────────────────────────────────────────────
document.getElementById('sidebar-nav').addEventListener('click', (e) => {
  const item = e.target.closest('.nav-item');
  if (item?.dataset.page) navigateTo(item.dataset.page);
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    // Fetch current user
    const { data: user } = await API.me();
    window.AppState.user = user;

    // Update topbar
    document.getElementById('user-name').textContent = user.username;
    if (user.avatar) {
      const avatarEl = document.getElementById('user-avatar');
      avatarEl.src = `https://cdn.discordapp.com/avatars/${user.userId}/${user.avatar}.png?size=64`;
    }

    // Update bot status dot
    const dot = document.getElementById('bot-status-dot');
    const txt = document.getElementById('bot-status-text');
    dot.classList.add('online');
    txt.textContent = 'Bot online';

    // Navigate to hash page or default
    const hash = window.location.hash.replace('#/', '') || 'overview';
    await navigateTo(hash);
  } catch (err) {
    if (err.message === 'Unauthenticated') return; // api.js already redirects
    console.error('Init error:', err);
  }
}

window.addEventListener('hashchange', () => {
  const page = window.location.hash.replace('#/', '') || 'overview';
  navigateTo(page);
});

init();