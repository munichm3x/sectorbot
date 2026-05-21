// dashboard/public-user/js/app.js
// Router, navigation, toast, global helpers for the public user dashboard.

window.AppState = { user: null };

const PAGE_TITLES = {
  'overview':  'Übersicht',
  'analytics': 'Server Analytics',
  'tickets':   'Meine Tickets',
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

// ── Helpers ───────────────────────────────────────────────────────────────────
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
window.emptyState   = emptyState;
window.loadingState = loadingState;
window.errorState   = errorState;
window.escapeHtml   = escapeHtml;

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

// ── Period selector ───────────────────────────────────────────────────────────
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

// ── Navigation ────────────────────────────────────────────────────────────────
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

async function navigateTo(page) {
  if (!Object.prototype.hasOwnProperty.call(PAGE_TITLES, page)) {
    document.getElementById('page-content').innerHTML = emptyState('Seite nicht gefunden.');
    return;
  }
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.page === page);
  });
  document.getElementById('page-title').textContent = PAGE_TITLES[page] ?? page;
  document.title = `${PAGE_TITLES[page] ?? page} — SECTOR 13`;
  history.pushState(null, '', '#/' + page);

  const content = document.getElementById('page-content');
  content.innerHTML = loadingState();

  try {
    const moduleId = 'page-' + page;
    if (!window[moduleId]) {
      await loadScript(`/public/js/pages/${page}.js`);
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

window.addEventListener('hashchange', () => {
  const page = window.location.hash.replace('#/', '') || 'overview';
  navigateTo(page);
});

// ── Init ──────────────────────────────────────────────────────────────────────
async function init() {
  try {
    const { data: user } = await API.me();
    window.AppState.user = user;

    document.getElementById('user-name').textContent = escapeHtml(user.username);
    if (user.avatar) {
      const avatarEl = document.getElementById('user-avatar');
      avatarEl.src = `https://cdn.discordapp.com/avatars/${encodeURIComponent(user.userId)}/${encodeURIComponent(user.avatar)}.png?size=64`;
    }

    const dot = document.getElementById('bot-status-dot');
    const txt = document.getElementById('bot-status-text');
    dot.classList.add('online');
    txt.textContent = 'Online';

    const hash = window.location.hash.replace('#/', '') || 'overview';
    await navigateTo(hash);
  } catch (err) {
    if (err.message === 'Unauthenticated') return;
    console.error('Init error:', err);
    const content = document.getElementById('page-content');
    if (content) content.innerHTML = errorState('Verbindung zum Server fehlgeschlagen. Bitte Seite neu laden.');
  }
}

init();
