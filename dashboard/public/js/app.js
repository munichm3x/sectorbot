// dashboard/public/js/app.js
// Router, navigation, auth check, toast notifications, global state.

// ── Global state ──────────────────────────────────────────────────────────────
window.AppState = { user: null };

// ── Page titles ───────────────────────────────────────────────────────────────
const PAGE_TITLES = {
  // Existing entries
  'overview':             'Dashboard',
  'public-preview':       'Public Preview',
  'analytics-messages':   'Nachrichten Analytics',
  'analytics-voice':      'Voice Analytics',
  'analytics-tickets':    'Ticket Analytics',
  'analytics-growth':     'Wachstum Analytics',
  'analytics-ai':         'AI Analytics',
  'analytics-status':     'Status Verlauf',
  'tickets':              'Tickets',
  'members':              'Mitglieder',
  'server-status':        'Serverstatus',
  'logs':                 'Logs',
  'ai':                   'AI',
  // Content management
  'admin-rules':          'Regelwerk verwalten',
  'admin-events':         'Events verwalten',
  'admin-changelog':      'Changelog verwalten',
  'admin-announcements':  'Announcements verwalten',
  'admin-faq':            'FAQ verwalten',
  'admin-server-info':    'Server-Info',
  'admin-wipe':           'Wipe-Info',
  // Settings
  'settings-general':     'Allgemeine Einstellungen',
  'settings-dashboard':   'Dashboard-Einstellungen',
  'settings-server':      'Server-Einstellungen',
  'settings-tickets':     'Ticket-Einstellungen',
  'settings-roles':       'Rollen & Teams',
  'settings-channels':    'Channel-Konfiguration',
  'settings-ai':          'AI-Einstellungen',
  'settings-streamer':    'Streamer / Twitch',
  'settings-whitelist':   'Whitelist',
  'settings-moderation':  'Moderation',
  'settings-design':      'Design & Branding',
  'settings-security':    'Security',
  'system':               'System',
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
function escapeHtml(s) {
  return String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function errorState(err) {
  return `<div class="empty-state"><div class="empty-icon" style="color:var(--offline)">✕</div><p>Fehler: ${escapeHtml(err)}</p></div>`;
}
window.emptyState = emptyState;
window.loadingState = loadingState;
window.errorState = errorState;
window.escapeHtml = escapeHtml;

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
  // Validate page against known pages to prevent path traversal
  if (!Object.prototype.hasOwnProperty.call(PAGE_TITLES, page)) {
    const content = document.getElementById('page-content');
    content.innerHTML = emptyState('Seite nicht gefunden.');
    return;
  }
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

const _loadedScripts = new Set();

function loadScript(src) {
  if (_loadedScripts.has(src)) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.onload  = () => { _loadedScripts.add(src); resolve(); };
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

// ── Mobile sidebar toggle ─────────────────────────────────────────────────────
(function() {
  const toggleBtn = document.getElementById('sidebar-toggle');
  const sidebar   = document.getElementById('sidebar');
  const overlay   = document.getElementById('sidebar-overlay');
  if (!toggleBtn || !sidebar) return;

  function openSidebar() {
    sidebar.classList.add('open');
    if (overlay) overlay.classList.add('visible');
  }
  function closeSidebar() {
    sidebar.classList.remove('open');
    if (overlay) overlay.classList.remove('visible');
  }

  toggleBtn.addEventListener('click', () => {
    sidebar.classList.contains('open') ? closeSidebar() : openSidebar();
  });
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Close sidebar on nav item click (mobile)
  document.getElementById('sidebar-nav').addEventListener('click', (e) => {
    if (e.target.closest('.nav-item') && window.innerWidth <= 768) closeSidebar();
  });
})();

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
    const content = document.getElementById('page-content');
    if (content) {
      content.innerHTML = errorState('Verbindung zum Server fehlgeschlagen. Bitte Seite neu laden.');
    }
  }
}

window.addEventListener('hashchange', () => {
  const page = window.location.hash.replace('#/', '') || 'overview';
  navigateTo(page);
});

init();