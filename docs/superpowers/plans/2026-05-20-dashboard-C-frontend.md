# Dashboard Sub-project C: Frontend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.
> **Prerequisite:** Sub-projects A and B must be complete. The Express server must be running and all API routes must work.

**Goal:** Build the complete dark-theme web dashboard frontend: HTML shell, CSS design system, vanilla JS router, and page implementations for Overview, Analytics (5 sub-pages), Tickets, Members, Server Status, Logs, Settings, and AI — all served as static files from `dashboard/public/`.

**Architecture:** Single HTML shell (`index.html`) with a sidebar + main area. Hash-based client-side routing (`#/page`). Each page is a vanilla JS module loaded dynamically. Chart.js loaded via CDN. All data fetched from the API via `js/api.js`. No build step — files are served directly by Express.

**Tech Stack:** Vanilla HTML5, CSS3 custom properties, Vanilla JavaScript (ES modules via CDN import or global namespace), Chart.js 4.x (CDN).

---

## File Map

| File | Purpose |
|---|---|
| `dashboard/public/login.html` | Login/auth page |
| `dashboard/public/index.html` | SPA shell: sidebar, topbar, main container |
| `dashboard/public/css/dashboard.css` | Full dark design system: variables, layout, components |
| `dashboard/public/js/api.js` | Fetch wrappers for all API routes |
| `dashboard/public/js/charts.js` | Chart.js default config and factory functions |
| `dashboard/public/js/app.js` | Router, navigation, auth check, global utilities |
| `dashboard/public/js/pages/overview.js` | Overview page |
| `dashboard/public/js/pages/analytics-messages.js` | Message analytics |
| `dashboard/public/js/pages/analytics-voice.js` | Voice & stream analytics |
| `dashboard/public/js/pages/analytics-tickets.js` | Ticket analytics |
| `dashboard/public/js/pages/analytics-growth.js` | Growth analytics |
| `dashboard/public/js/pages/analytics-ai.js` | AI usage analytics |
| `dashboard/public/js/pages/analytics-status.js` | Server status analytics |
| `dashboard/public/js/pages/tickets.js` | Ticket management table |
| `dashboard/public/js/pages/members.js` | Member list |
| `dashboard/public/js/pages/server-status.js` | Live server status |
| `dashboard/public/js/pages/logs.js` | Log viewer + SSE stream |
| `dashboard/public/js/pages/settings.js` | Settings forms |
| `dashboard/public/js/pages/ai.js` | AI usage overview |

---

### Task 1: Create CSS Design System

**Files:**
- Create: `dashboard/public/css/dashboard.css`

- [ ] **Step 1: Create the directory and CSS file**

```
mkdir -p dashboard/public/css
```

Create `dashboard/public/css/dashboard.css`:

```css
/* ── Design Tokens ────────────────────────────────────────────────────────── */
:root {
  --bg:              #0a0a0c;
  --surface:         #111115;
  --surface-raised:  #18181e;
  --surface-hover:   #1e1e28;
  --border:          #1e1e28;
  --border-subtle:   #161619;
  --accent:          #8b0000;
  --accent-hover:    #a01010;
  --accent-glow:     rgba(139, 0, 0, 0.15);
  --online:          #57f287;
  --offline:         #ed4245;
  --warning:         #faa61a;
  --success:         #3e9142;
  --text:            #e8e8ee;
  --text-secondary:  #9090a0;
  --text-muted:      #505060;
  --mono:            'JetBrains Mono', 'Fira Code', 'Courier New', monospace;
  --sans:            -apple-system, BlinkMacSystemFont, 'Segoe UI', system-ui, sans-serif;
  --radius:          6px;
  --radius-lg:       10px;
  --shadow:          0 2px 16px rgba(0,0,0,0.6);
  --sidebar-w:       240px;
  --topbar-h:        56px;
  --transition:      150ms ease;
}

/* ── Reset ─────────────────────────────────────────────────────────────────── */
*, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
html { font-size: 14px; -webkit-font-smoothing: antialiased; }
body {
  font-family: var(--sans);
  background: var(--bg);
  color: var(--text);
  min-height: 100vh;
  overflow-x: hidden;
}
a { color: var(--accent); text-decoration: none; }
a:hover { text-decoration: underline; }
button { cursor: pointer; border: none; background: none; }
input, select, textarea { font-family: inherit; font-size: inherit; }

/* ── Layout ────────────────────────────────────────────────────────────────── */
#app { display: flex; min-height: 100vh; }

.sidebar {
  width: var(--sidebar-w);
  background: var(--surface);
  border-right: 1px solid var(--border);
  display: flex;
  flex-direction: column;
  position: fixed;
  top: 0; left: 0; bottom: 0;
  z-index: 100;
  overflow-y: auto;
}

.sidebar-logo {
  padding: 1.25rem 1rem;
  border-bottom: 1px solid var(--border);
  display: flex;
  align-items: center;
  gap: 0.75rem;
}
.sidebar-logo .logo-mark {
  width: 32px; height: 32px;
  background: var(--accent);
  border-radius: 6px;
  display: flex; align-items: center; justify-content: center;
  font-weight: 800; font-size: 0.9rem; color: #fff;
  flex-shrink: 0;
}
.sidebar-logo .logo-text { font-weight: 700; font-size: 0.85rem; line-height: 1.2; }
.sidebar-logo .logo-sub  { font-size: 0.7rem; color: var(--text-muted); }

.sidebar-nav { flex: 1; padding: 0.5rem 0; }

.nav-section { padding: 0.75rem 1rem 0.25rem; font-size: 0.65rem; font-weight: 700; letter-spacing: 0.1em; text-transform: uppercase; color: var(--text-muted); }

.nav-item {
  display: flex; align-items: center; gap: 0.6rem;
  padding: 0.5rem 1rem;
  color: var(--text-secondary);
  cursor: pointer;
  border-radius: 0;
  transition: color var(--transition), background var(--transition);
  font-size: 0.85rem;
  user-select: none;
}
.nav-item:hover { color: var(--text); background: var(--surface-hover); }
.nav-item.active { color: var(--text); background: var(--accent-glow); border-left: 2px solid var(--accent); }
.nav-item .nav-icon { width: 16px; text-align: center; flex-shrink: 0; }
.nav-item.sub { padding-left: 2.25rem; font-size: 0.8rem; }

.sidebar-footer {
  padding: 0.75rem 1rem;
  border-top: 1px solid var(--border);
  font-size: 0.75rem;
}
.bot-status {
  display: flex; align-items: center; gap: 0.5rem;
  color: var(--text-secondary);
}
.status-dot {
  width: 8px; height: 8px;
  border-radius: 50%;
  background: var(--offline);
  flex-shrink: 0;
}
.status-dot.online { background: var(--online); box-shadow: 0 0 6px var(--online); }

/* ── Main Content ────────────────────────────────────────────────────────── */
.main {
  margin-left: var(--sidebar-w);
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 100vh;
}

.topbar {
  height: var(--topbar-h);
  background: var(--surface);
  border-bottom: 1px solid var(--border);
  display: flex; align-items: center; justify-content: space-between;
  padding: 0 1.5rem;
  position: sticky; top: 0; z-index: 50;
}
.topbar-title {
  font-size: 1rem; font-weight: 600; letter-spacing: -0.01em;
}
.topbar-right { display: flex; align-items: center; gap: 1rem; }
.topbar-user {
  display: flex; align-items: center; gap: 0.5rem;
  color: var(--text-secondary); font-size: 0.8rem;
}
.topbar-avatar {
  width: 28px; height: 28px;
  border-radius: 50%;
  background: var(--surface-raised);
  object-fit: cover;
}

.page-content { flex: 1; padding: 1.5rem; max-width: 1400px; }
.page-header {
  margin-bottom: 1.5rem;
}
.page-header h1 { font-size: 1.35rem; font-weight: 700; margin-bottom: 0.25rem; }
.page-header p  { color: var(--text-secondary); font-size: 0.85rem; }

/* ── Cards ────────────────────────────────────────────────────────────────── */
.card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
}
.card-header {
  display: flex; align-items: center; justify-content: space-between;
  margin-bottom: 1rem;
}
.card-title {
  font-size: 0.8rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--text-secondary);
}

/* ── Stat Cards ───────────────────────────────────────────────────────────── */
.stat-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(180px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.stat-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.1rem 1.25rem;
}
.stat-label {
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: var(--text-muted);
  margin-bottom: 0.4rem;
}
.stat-value {
  font-size: 1.6rem;
  font-weight: 700;
  font-family: var(--mono);
  line-height: 1;
  margin-bottom: 0.3rem;
}
.stat-value.online { color: var(--online); }
.stat-value.offline { color: var(--offline); }
.stat-sub {
  font-size: 0.72rem;
  color: var(--text-muted);
}
.stat-delta {
  display: inline-flex; align-items: center; gap: 0.2em;
  font-size: 0.72rem; font-weight: 600;
}
.stat-delta.up   { color: var(--online); }
.stat-delta.down { color: var(--offline); }

/* ── Chart Cards ─────────────────────────────────────────────────────────── */
.chart-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 1.25rem;
  margin-bottom: 1rem;
}
.chart-card canvas { display: block; width: 100% !important; }

/* ── Grid Layouts ────────────────────────────────────────────────────────── */
.grid-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
.grid-3 { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 1rem; }
@media (max-width: 900px) { .grid-2, .grid-3 { grid-template-columns: 1fr; } }

/* ── Tables ────────────────────────────────────────────────────────────────── */
.table-wrap { overflow-x: auto; }
table {
  width: 100%;
  border-collapse: collapse;
  font-size: 0.82rem;
}
th {
  text-align: left;
  padding: 0.6rem 0.9rem;
  border-bottom: 1px solid var(--border);
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  color: var(--text-muted);
  white-space: nowrap;
}
td {
  padding: 0.65rem 0.9rem;
  border-bottom: 1px solid var(--border-subtle);
  color: var(--text-secondary);
  vertical-align: middle;
}
tr:last-child td { border-bottom: none; }
tr:hover td { background: var(--surface-hover); color: var(--text); }

/* ── Badges ─────────────────────────────────────────────────────────────── */
.badge {
  display: inline-flex; align-items: center; gap: 0.3em;
  padding: 0.2em 0.6em;
  border-radius: 4px;
  font-size: 0.7rem;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.badge-online  { background: rgba(87,242,135,0.12); color: var(--online); }
.badge-offline { background: rgba(237,66,69,0.12);  color: var(--offline); }
.badge-warning { background: rgba(250,166,26,0.12); color: var(--warning); }
.badge-neutral { background: var(--surface-raised); color: var(--text-secondary); }
.badge-accent  { background: var(--accent-glow);    color: var(--accent); }

/* ── Buttons ─────────────────────────────────────────────────────────────── */
.btn {
  display: inline-flex; align-items: center; gap: 0.4rem;
  padding: 0.45rem 0.9rem;
  border-radius: var(--radius);
  font-size: 0.8rem;
  font-weight: 600;
  transition: background var(--transition), opacity var(--transition);
  cursor: pointer;
}
.btn-primary {
  background: var(--accent);
  color: #fff;
  border: 1px solid transparent;
}
.btn-primary:hover { background: var(--accent-hover); }
.btn-ghost {
  background: transparent;
  color: var(--text-secondary);
  border: 1px solid var(--border);
}
.btn-ghost:hover { background: var(--surface-hover); color: var(--text); }
.btn-danger {
  background: rgba(237,66,69,0.12);
  color: var(--offline);
  border: 1px solid rgba(237,66,69,0.25);
}
.btn:disabled { opacity: 0.4; cursor: not-allowed; }

/* ── Form Elements ────────────────────────────────────────────────────────── */
.form-group { margin-bottom: 1rem; }
.form-label {
  display: block;
  font-size: 0.75rem;
  font-weight: 600;
  color: var(--text-secondary);
  margin-bottom: 0.35rem;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.form-input {
  width: 100%;
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  color: var(--text);
  padding: 0.5rem 0.75rem;
  font-size: 0.85rem;
  transition: border-color var(--transition);
  outline: none;
}
.form-input:focus { border-color: var(--accent); }
.form-input[type="password"] { font-family: var(--mono); letter-spacing: 0.1em; }

/* ── Period Selector ─────────────────────────────────────────────────────── */
.period-bar {
  display: flex; gap: 0.4rem;
  margin-bottom: 1.25rem;
}
.period-btn {
  padding: 0.3rem 0.7rem;
  border-radius: var(--radius);
  font-size: 0.75rem;
  font-weight: 600;
  background: var(--surface-raised);
  color: var(--text-secondary);
  border: 1px solid var(--border);
  cursor: pointer;
  transition: all var(--transition);
}
.period-btn.active {
  background: var(--accent-glow);
  color: var(--accent);
  border-color: var(--accent);
}
.period-btn:hover:not(.active) { color: var(--text); }

/* ── Empty / Loading States ──────────────────────────────────────────────── */
.empty-state {
  text-align: center;
  padding: 3rem 1rem;
  color: var(--text-muted);
}
.empty-state .empty-icon { font-size: 2rem; margin-bottom: 0.75rem; opacity: 0.4; }
.empty-state p { font-size: 0.85rem; }

.skeleton {
  background: linear-gradient(90deg, var(--surface-raised) 25%, var(--surface-hover) 50%, var(--surface-raised) 75%);
  background-size: 200% 100%;
  animation: shimmer 1.5s infinite;
  border-radius: var(--radius);
  height: 1rem;
}
.skeleton.tall { height: 200px; }
.skeleton.short { height: 0.7rem; width: 60%; }
@keyframes shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }

/* ── Toasts ─────────────────────────────────────────────────────────────── */
#toast-container {
  position: fixed; bottom: 1.5rem; right: 1.5rem;
  z-index: 9999;
  display: flex; flex-direction: column; gap: 0.5rem;
}
.toast {
  background: var(--surface-raised);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  padding: 0.75rem 1rem;
  font-size: 0.82rem;
  max-width: 320px;
  animation: slideIn 0.2s ease;
  box-shadow: var(--shadow);
}
.toast.success { border-left: 3px solid var(--online); }
.toast.error   { border-left: 3px solid var(--offline); }
.toast.info    { border-left: 3px solid var(--accent); }
@keyframes slideIn { from { opacity: 0; transform: translateX(20px); } to { opacity: 1; transform: translateX(0); } }

/* ── Analytics tabs ─────────────────────────────────────────────────────── */
.tab-bar {
  display: flex; gap: 0; flex-wrap: wrap;
  border-bottom: 1px solid var(--border);
  margin-bottom: 1.5rem;
}
.tab-btn {
  padding: 0.6rem 1rem;
  font-size: 0.8rem;
  font-weight: 600;
  color: var(--text-muted);
  background: none;
  border: none;
  border-bottom: 2px solid transparent;
  cursor: pointer;
  transition: color var(--transition), border-color var(--transition);
  margin-bottom: -1px;
}
.tab-btn.active { color: var(--text); border-bottom-color: var(--accent); }
.tab-btn:hover:not(.active) { color: var(--text-secondary); }

/* ── Mono values ─────────────────────────────────────────────────────────── */
.mono { font-family: var(--mono); }
.dim  { color: var(--text-muted); }
.tag  { color: var(--text-secondary); }

/* ── Scrollbar ────────────────────────────────────────────────────────────── */
::-webkit-scrollbar { width: 6px; height: 6px; }
::-webkit-scrollbar-track { background: var(--bg); }
::-webkit-scrollbar-thumb { background: var(--border); border-radius: 3px; }
::-webkit-scrollbar-thumb:hover { background: var(--text-muted); }

/* ── Responsive ──────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); transition: transform 0.25s ease; }
  .sidebar.open { transform: translateX(0); }
  .main { margin-left: 0; }
  .stat-grid { grid-template-columns: 1fr 1fr; }
}
```

- [ ] **Step 2: Verify file was created**

```
ls dashboard/public/css/
```

Expected: `dashboard.css`

- [ ] **Step 3: Commit**

```
git add dashboard/public/css/dashboard.css
git commit -m "feat(frontend): dashboard CSS design system"
```

---

### Task 2: Create Login Page

**Files:**
- Create: `dashboard/public/login.html`

- [ ] **Step 1: Create the file**

Create `dashboard/public/login.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Login — SECTOR 13 Control</title>
  <link rel="stylesheet" href="/css/dashboard.css">
  <style>
    body { display: flex; align-items: center; justify-content: center; min-height: 100vh; }
    .login-box {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 2.5rem 2rem;
      width: 100%;
      max-width: 360px;
      text-align: center;
    }
    .login-logo {
      width: 56px; height: 56px;
      background: var(--accent);
      border-radius: 12px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.5rem; font-weight: 900; color: #fff;
      margin: 0 auto 1.25rem;
    }
    .login-title { font-size: 1.1rem; font-weight: 700; margin-bottom: 0.25rem; }
    .login-sub   { font-size: 0.8rem; color: var(--text-muted); margin-bottom: 1.75rem; }
    .discord-btn {
      display: inline-flex; align-items: center; justify-content: center; gap: 0.6rem;
      width: 100%;
      background: #5865f2;
      color: #fff;
      border: none;
      border-radius: var(--radius);
      padding: 0.7rem 1rem;
      font-size: 0.9rem;
      font-weight: 700;
      cursor: pointer;
      text-decoration: none;
      transition: background 0.15s;
    }
    .discord-btn:hover { background: #4752c4; text-decoration: none; }
    .login-note { font-size: 0.72rem; color: var(--text-muted); margin-top: 1.25rem; }
  </style>
</head>
<body>
  <div class="login-box">
    <div class="login-logo">S</div>
    <div class="login-title">SECTOR 13 Control</div>
    <div class="login-sub">Admin Dashboard — nur für autorisierte Teammitglieder</div>
    <a href="/auth/login" class="discord-btn">
      <svg width="20" height="15" viewBox="0 0 71 55" fill="white" xmlns="http://www.w3.org/2000/svg">
        <path d="M60.1 4.9A58.5 58.5 0 0 0 45.5 0.5a40 40 0 0 0-1.8 3.7 54.2 54.2 0 0 0-16.3 0 40 40 0 0 0-1.8-3.7A58.3 58.3 0 0 0 11 4.9C1.6 19 -1 32.8 0.3 46.4a58.9 58.9 0 0 0 17.9 9 44.1 44.1 0 0 0 3.8-6.2 38.3 38.3 0 0 1-6-2.9l1.5-1.1a41.9 41.9 0 0 0 36 0l1.5 1.1a38.4 38.4 0 0 1-6 2.9 44.5 44.5 0 0 0 3.8 6.2 58.7 58.7 0 0 0 17.9-9C72 32.2 68.8 18.5 60.1 4.9zM23.7 38a6.7 6.7 0 0 1-6.3-7 6.7 6.7 0 0 1 6.3-7 6.7 6.7 0 0 1 6.3 7 6.7 6.7 0 0 1-6.3 7zm23.6 0a6.7 6.7 0 0 1-6.3-7 6.7 6.7 0 0 1 6.3-7 6.7 6.7 0 0 1 6.3 7 6.7 6.7 0 0 1-6.3 7z"/>
      </svg>
      Mit Discord anmelden
    </a>
    <p class="login-note">Zugang nur für Server-Admins und autorisierte Teammitglieder.<br>Deine Session läuft nach 24h ab.</p>
  </div>
</body>
</html>
```

- [ ] **Step 2: Commit**

```
git add dashboard/public/login.html
git commit -m "feat(frontend): login page"
```

---

### Task 3: Create SPA Shell (index.html)

**Files:**
- Create: `dashboard/public/index.html`

- [ ] **Step 1: Create the file**

Create `dashboard/public/index.html`:

```html
<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SECTOR 13 Control</title>
  <link rel="stylesheet" href="/css/dashboard.css">
  <!-- Chart.js from CDN -->
  <script src="https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js"></script>
</head>
<body>
<div id="app">
  <!-- Sidebar -->
  <aside class="sidebar" id="sidebar">
    <div class="sidebar-logo">
      <div class="logo-mark">S</div>
      <div>
        <div class="logo-text">SECTOR 13</div>
        <div class="logo-sub">Control Panel</div>
      </div>
    </div>

    <nav class="sidebar-nav" id="sidebar-nav">
      <div class="nav-section">Übersicht</div>
      <div class="nav-item" data-page="overview">
        <span class="nav-icon">⬡</span> Overview
      </div>

      <div class="nav-section">Analytics</div>
      <div class="nav-item" data-page="analytics-messages">
        <span class="nav-icon">✉</span> Nachrichten
      </div>
      <div class="nav-item" data-page="analytics-voice">
        <span class="nav-icon">🎙</span> Voice & Stream
      </div>
      <div class="nav-item" data-page="analytics-tickets">
        <span class="nav-icon">🎫</span> Tickets
      </div>
      <div class="nav-item" data-page="analytics-growth">
        <span class="nav-icon">📈</span> Wachstum
      </div>
      <div class="nav-item" data-page="analytics-ai">
        <span class="nav-icon">◈</span> AI Usage
      </div>
      <div class="nav-item" data-page="analytics-status">
        <span class="nav-icon">◉</span> Serverstatus
      </div>

      <div class="nav-section">Management</div>
      <div class="nav-item" data-page="tickets">
        <span class="nav-icon">📋</span> Tickets
      </div>
      <div class="nav-item" data-page="members">
        <span class="nav-icon">👥</span> Mitglieder
      </div>
      <div class="nav-item" data-page="server-status">
        <span class="nav-icon">⚡</span> Server Status
      </div>

      <div class="nav-section">System</div>
      <div class="nav-item" data-page="logs">
        <span class="nav-icon">📄</span> Logs
      </div>
      <div class="nav-item" data-page="ai">
        <span class="nav-icon">🤖</span> AI
      </div>
      <div class="nav-item" data-page="settings">
        <span class="nav-icon">⚙</span> Einstellungen
      </div>
    </nav>

    <div class="sidebar-footer">
      <div class="bot-status">
        <div class="status-dot" id="bot-status-dot"></div>
        <span id="bot-status-text">Verbinde...</span>
      </div>
    </div>
  </aside>

  <!-- Main area -->
  <main class="main">
    <header class="topbar">
      <div class="topbar-title" id="page-title">Overview</div>
      <div class="topbar-right">
        <div class="topbar-user">
          <img class="topbar-avatar" id="user-avatar" src="" alt="" onerror="this.style.display='none'">
          <span id="user-name">—</span>
        </div>
        <a href="/auth/logout" class="btn btn-ghost" style="font-size:0.75rem;padding:0.3rem 0.6rem;">Logout</a>
      </div>
    </header>

    <div class="page-content" id="page-content">
      <!-- Page content rendered here by JS -->
      <div class="empty-state">
        <div class="empty-icon">⬡</div>
        <p>Lade Dashboard...</p>
      </div>
    </div>
  </main>
</div>

<!-- Toast container -->
<div id="toast-container"></div>

<!-- App scripts -->
<script src="/js/api.js"></script>
<script src="/js/charts.js"></script>
<script src="/js/app.js"></script>
</body>
</html>
```

- [ ] **Step 2: Commit**

```
git add dashboard/public/index.html
git commit -m "feat(frontend): SPA shell with sidebar and topbar"
```

---

### Task 4: Create API Client and Chart Helpers

**Files:**
- Create: `dashboard/public/js/api.js`
- Create: `dashboard/public/js/charts.js`

- [ ] **Step 1: Create js/ directory and api.js**

```
mkdir -p dashboard/public/js/pages
```

Create `dashboard/public/js/api.js`:

```javascript
// dashboard/public/js/api.js
// Fetch wrappers for all API routes.
// All requests include credentials (session cookie).

const API = {
  async _fetch(url, options = {}) {
    const res = await fetch(url, { credentials: 'same-origin', ...options });
    if (res.status === 401) { window.location.href = '/login.html'; throw new Error('Unauthenticated'); }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

  async get(path) { return this._fetch('/api' + path); },

  async patch(path, body) {
    return this._fetch('/api' + path, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  async post(path, body = {}) {
    return this._fetch('/api' + path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  // Convenience methods
  me:           () => API.get('/me'),
  overview:     () => API.get('/overview'),
  messages:     (p) => API.get(`/analytics/messages?period=${p}`),
  voice:        (p) => API.get(`/analytics/voice?period=${p}`),
  growth:       (p) => API.get(`/analytics/growth?period=${p}`),
  ai:           (p) => API.get(`/analytics/ai?period=${p}`),
  commands:     (p) => API.get(`/analytics/commands?period=${p}`),
  statusHistory:(p) => API.get(`/analytics/server-status?period=${p}`),
  ticketStats:  (p) => API.get(`/analytics/tickets?period=${p}`),
  tickets:      (q) => API.get(`/tickets?${new URLSearchParams(q)}`),
  ticket:       (id) => API.get(`/tickets/${id}`),
  members:      () => API.get('/members'),
  settings:     () => API.get('/settings'),
  logs:         (q) => API.get(`/logs?${new URLSearchParams(q ?? {})}`),
  auditLogs:    () => API.get('/logs/audit'),
  serverStatus: () => API.get('/server-status'),
  testStatus:   () => API.post('/server-status/test'),
};

window.API = API;
```

- [ ] **Step 2: Create charts.js**

Create `dashboard/public/js/charts.js`:

```javascript
// dashboard/public/js/charts.js
// Chart.js global defaults and factory functions.

Chart.defaults.color           = '#9090a0';
Chart.defaults.borderColor     = '#1e1e28';
Chart.defaults.font.family     = 'system-ui, sans-serif';
Chart.defaults.font.size       = 11;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = '#18181e';
Chart.defaults.plugins.tooltip.borderColor     = '#1e1e28';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.titleColor      = '#e8e8ee';
Chart.defaults.plugins.tooltip.bodyColor       = '#9090a0';
Chart.defaults.plugins.tooltip.padding         = 10;

const ACCENT  = '#8b0000';
const ONLINE  = '#57f287';
const WARNING = '#faa61a';

/** Destroy existing chart on a canvas, return canvas element. */
function getCanvas(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const existing = Chart.getChart(el);
  if (existing) existing.destroy();
  return el;
}

/** Format unix timestamp (seconds) to "DD.MM." */
function fmtDay(ts) {
  const d = new Date(ts * 1000);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`;
}

/** Format seconds to "Xh Ym" */
function fmtDuration(secs) {
  if (!secs) return '0s';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Line chart: daily timeseries */
function lineChart(id, labels, datasets, yLabel = '') {
  const el = getCanvas(id);
  if (!el) return null;
  return new Chart(el, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1 } },
      scales: {
        x: { grid: { color: '#1e1e2820' } },
        y: {
          beginAtZero: true,
          grid: { color: '#1e1e2820' },
          title: yLabel ? { display: true, text: yLabel, color: '#505060' } : { display: false },
        },
      },
    },
  });
}

/** Bar chart: category comparison */
function barChart(id, labels, data, color = ACCENT) {
  const el = getCanvas(id);
  if (!el) return null;
  return new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: color + '99', borderColor: color, borderWidth: 1, borderRadius: 3 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#1e1e2820' } },
      },
    },
  });
}

/** Donut chart */
function donutChart(id, labels, data, colors) {
  const el = getCanvas(id);
  if (!el) return null;
  return new Chart(el, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors ?? [ACCENT, ONLINE, WARNING, '#4a90d9', '#b36b00'], borderWidth: 0, hoverOffset: 4 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { display: true, position: 'right' } },
    },
  });
}

window.Charts = { lineChart, barChart, donutChart, fmtDay, fmtDuration, getCanvas };
```

- [ ] **Step 3: Commit**

```
git add dashboard/public/js/api.js dashboard/public/js/charts.js
git commit -m "feat(frontend): API client and Chart.js helpers"
```

---

### Task 5: Create App Router and Navigation

**Files:**
- Create: `dashboard/public/js/app.js`

- [ ] **Step 1: Create app.js**

Create `dashboard/public/js/app.js`:

```javascript
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
```

- [ ] **Step 2: Commit**

```
git add dashboard/public/js/app.js
git commit -m "feat(frontend): app router, navigation, toast, and global helpers"
```

---

### Task 6: Create Overview Page

**Files:**
- Create: `dashboard/public/js/pages/overview.js`

- [ ] **Step 1: Create the file**

Create `dashboard/public/js/pages/overview.js`:

```javascript
// dashboard/public/js/pages/overview.js
window['page-overview'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Overview</h1>
        <p>Echtzeit-Überblick über Bot, Server und Discord-Aktivität.</p>
      </div>
      <div id="ov-content"><div class="skeleton tall"></div></div>
    `;

    try {
      const { data } = await API.overview();
      const { bot, serverStatus, tickets, activity, guild } = data;

      document.getElementById('ov-content').innerHTML = `
        <!-- KPI Row 1 -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-label">Bot Status</div>
            <div class="stat-value ${bot.status === 'online' ? 'online' : 'offline'}">${bot.status === 'online' ? '● Online' : '○ Offline'}</div>
            <div class="stat-sub">Uptime: ${fmtUptime(bot.uptimeSec)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Latenz</div>
            <div class="stat-value mono">${bot.latencyMs ?? '—'}<small style="font-size:0.9rem">ms</small></div>
            <div class="stat-sub">WebSocket Ping</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Mitglieder</div>
            <div class="stat-value">${fmt(guild?.memberCount)}</div>
            <div class="stat-sub">+${fmt(activity.memberJoins)} heute</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">SCUM Server</div>
            <div class="stat-value ${serverStatus?.online ? 'online' : 'offline'}">${serverStatus?.online ? '● Online' : '○ Offline'}</div>
            <div class="stat-sub">${serverStatus?.online ? `${serverStatus.playersOnline}/${serverStatus.maxPlayers} Spieler` : 'Kein Status'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Offene Tickets</div>
            <div class="stat-value">${tickets.open}</div>
            <div class="stat-sub">${tickets.closedToday} heute gelöst</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Nachrichten 24h</div>
            <div class="stat-value">${fmt(activity.messages)}</div>
            <div class="stat-sub">Discord-Aktivität</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Voice 24h</div>
            <div class="stat-value">${Charts.fmtDuration(activity.voiceSecs)}</div>
            <div class="stat-sub">Kumuliert</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">AI Requests 24h</div>
            <div class="stat-value">${fmt(activity.aiRequests)}</div>
            <div class="stat-sub">Groq / Ollama</div>
          </div>
        </div>

        <!-- Quick cards -->
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div class="card-title">Serverstatus</div></div>
            ${serverStatus ? `
              <p><span class="badge ${serverStatus.online ? 'badge-online' : 'badge-offline'}">${serverStatus.online ? 'Online' : 'Offline'}</span></p>
              ${serverStatus.online ? `
                <p style="margin-top:.75rem;color:var(--text-secondary);font-size:.85rem">
                  Spieler: <strong style="color:var(--text)">${serverStatus.playersOnline}/${serverStatus.maxPlayers}</strong> &nbsp;·&nbsp;
                  Ping: <strong style="color:var(--text)">${serverStatus.ping ?? '—'}ms</strong>
                </p>` : ''}
              <p style="margin-top:.5rem;font-size:.75rem;color:var(--text-muted)">Letzter Check: ${fmtDate(serverStatus.lastCheck)}</p>
            ` : '<p class="dim" style="font-size:.85rem">Noch kein Status — Server konfigurieren.</p>'}
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">Tickets</div></div>
            <div style="display:flex;gap:1.5rem">
              <div><div class="stat-label">Offen</div><div class="stat-value" style="font-size:1.4rem">${tickets.open}</div></div>
              <div><div class="stat-label">7 Tage</div><div class="stat-value" style="font-size:1.4rem">${tickets.closedWeek}</div></div>
            </div>
            <p style="margin-top:.75rem;font-size:.75rem;color:var(--text-muted)">→ <a href="#/tickets">Alle Tickets ansehen</a></p>
          </div>
        </div>
      `;
    } catch (err) {
      document.getElementById('ov-content').innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 2: Commit**

```
git add dashboard/public/js/pages/overview.js
git commit -m "feat(frontend): overview page with KPI cards"
```

---

### Task 7: Create Analytics Pages

**Files:**
- Create: `dashboard/public/js/pages/analytics-messages.js`
- Create: `dashboard/public/js/pages/analytics-voice.js`
- Create: `dashboard/public/js/pages/analytics-tickets.js`
- Create: `dashboard/public/js/pages/analytics-growth.js`
- Create: `dashboard/public/js/pages/analytics-ai.js`
- Create: `dashboard/public/js/pages/analytics-status.js`

- [ ] **Step 1: Create analytics-messages.js**

Create `dashboard/public/js/pages/analytics-messages.js`:

```javascript
// dashboard/public/js/pages/analytics-messages.js
window['page-analytics-messages'] = {
  period: '7d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Nachrichten Analytics</h1><p>Aggregierte Nachrichtenaktivität — kein Nachrichteninhalt gespeichert.</p></div>
      <div id="msg-period"></div>
      <div id="msg-stats" class="stat-grid" style="margin-bottom:1rem"></div>
      <div class="grid-2">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nachrichten pro Tag</div><div style="height:220px"><canvas id="msg-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Top Channels</div><div style="height:220px"><canvas id="msg-channel-chart"></canvas></div></div>
      </div>
    `;

    // Period selector
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(container); });
    document.getElementById('msg-period').replaceWith(pb);
    pb.id = 'msg-period';

    await self.load(container);
  },

  async load(container) {
    const statsEl   = document.getElementById('msg-stats');
    const dailyEl   = document.getElementById('msg-daily-chart')?.parentElement;
    const channelEl = document.getElementById('msg-channel-chart')?.parentElement;
    if (!statsEl) return;
    statsEl.innerHTML = '<div class="skeleton" style="height:80px;grid-column:1/-1"></div>';

    try {
      const { data } = await API.messages(this.period);
      const { byDay, byChannel, total } = data;

      statsEl.innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${fmt(total)}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Aktive Channels</div><div class="stat-value">${byChannel.length}</div><div class="stat-sub">mit Aktivität</div></div>
        <div class="stat-card"><div class="stat-label">Ø pro Tag</div><div class="stat-value">${byDay.length > 0 ? fmt(Math.round(total / byDay.length)) : '—'}</div><div class="stat-sub">Tagesdurchschnitt</div></div>
      `;

      if (byDay.length === 0) {
        dailyEl.innerHTML = emptyState('Noch keine Daten für diesen Zeitraum.');
      } else {
        dailyEl.innerHTML = '<canvas id="msg-daily-chart"></canvas>';
        Charts.lineChart('msg-daily-chart',
          byDay.map(r => Charts.fmtDay(r.date_ts)),
          [{ label: 'Nachrichten', data: byDay.map(r => r.count), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]);
      }

      if (byChannel.length === 0) {
        channelEl.innerHTML = emptyState('Keine Channel-Daten.');
      } else {
        channelEl.innerHTML = '<canvas id="msg-channel-chart"></canvas>';
        Charts.barChart('msg-channel-chart',
          byChannel.slice(0,10).map(r => r.channel_id.slice(-6)),
          byChannel.slice(0,10).map(r => r.count));
      }
    } catch (err) {
      statsEl.innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 2: Create analytics-voice.js**

Create `dashboard/public/js/pages/analytics-voice.js`:

```javascript
// dashboard/public/js/pages/analytics-voice.js
window['page-analytics-voice'] = {
  period: '7d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Voice & Stream Analytics</h1><p>Aggregierte Voice- und Stream-Zeit — keine personenbezogenen Daten.</p></div>
      <div id="vc-period"></div>
      <div id="vc-stats" class="stat-grid"></div>
      <div class="grid-2" style="margin-top:1rem">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Voice-Zeit pro Tag (Stunden)</div><div style="height:220px"><canvas id="vc-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Top Voice-Channels</div><div style="height:220px"><canvas id="vc-channel-chart"></canvas></div></div>
      </div>
    `;
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(); });
    document.getElementById('vc-period').replaceWith(pb); pb.id = 'vc-period';
    await self.load();
  },

  async load() {
    try {
      const { data } = await API.voice(this.period);
      const { byDay, byChannel, totalSeconds, totalStreamSeconds } = data;

      document.getElementById('vc-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Voice-Zeit</div><div class="stat-value">${Charts.fmtDuration(totalSeconds)}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Stream-Zeit</div><div class="stat-value">${Charts.fmtDuration(totalStreamSeconds)}</div><div class="stat-sub">kumuliert</div></div>
        <div class="stat-card"><div class="stat-label">Sessions</div><div class="stat-value">${fmt(byDay.reduce((a,r)=>a+r.session_count,0))}</div><div class="stat-sub">Voice-Joins</div></div>
      `;

      if (byDay.length > 0) {
        Charts.lineChart('vc-daily-chart',
          byDay.map(r => Charts.fmtDay(r.date_ts)),
          [{ label: 'Voice (h)', data: byDay.map(r => Math.round(r.total_seconds / 360) / 10), borderColor: '#4a90d9', backgroundColor: 'rgba(74,144,217,0.1)', tension: 0.3, fill: true }]);
      } else {
        document.getElementById('vc-daily-chart').parentElement.innerHTML = emptyState('Noch keine Voice-Daten.');
      }

      if (byChannel.length > 0) {
        Charts.barChart('vc-channel-chart',
          byChannel.slice(0,10).map(r => r.channel_id.slice(-6)),
          byChannel.slice(0,10).map(r => Math.round(r.total_seconds / 60)),
          '#4a90d9');
      } else {
        document.getElementById('vc-channel-chart').parentElement.innerHTML = emptyState('Keine Channel-Daten.');
      }
    } catch (err) {
      document.getElementById('vc-stats').innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 3: Create analytics-tickets.js**

Create `dashboard/public/js/pages/analytics-tickets.js`:

```javascript
// dashboard/public/js/pages/analytics-tickets.js
window['page-analytics-tickets'] = {
  period: '30d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Ticket Analytics</h1><p>Aggregierte Ticket-Statistiken.</p></div>
      <div id="ta-period"></div>
      <div id="ta-stats" class="stat-grid"></div>
      <div class="grid-2" style="margin-top:1rem">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Tickets pro Tag</div><div style="height:220px"><canvas id="ta-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nach Kategorie</div><div style="height:220px"><canvas id="ta-cat-chart"></canvas></div></div>
      </div>
    `;
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(); });
    document.getElementById('ta-period').replaceWith(pb); pb.id = 'ta-period';
    await self.load();
  },

  async load() {
    try {
      const { data } = await API.ticketStats(this.period);
      const { total, open, closed, byCategory, byDay, avgResolutionSecs } = data;

      document.getElementById('ta-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${total}</div><div class="stat-sub">alle Tickets</div></div>
        <div class="stat-card"><div class="stat-label">Offen</div><div class="stat-value" style="color:var(--warning)">${open}</div><div class="stat-sub">aktiv</div></div>
        <div class="stat-card"><div class="stat-label">Geschlossen</div><div class="stat-value" style="color:var(--online)">${closed}</div><div class="stat-sub">abgeschlossen</div></div>
        <div class="stat-card"><div class="stat-label">Ø Lösungszeit</div><div class="stat-value">${avgResolutionSecs ? Charts.fmtDuration(avgResolutionSecs) : '—'}</div><div class="stat-sub">Ø Dauer</div></div>
      `;

      if (byDay.length > 0) {
        Charts.lineChart('ta-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)),
          [{ label: 'Tickets', data: byDay.map(r => r.count), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]);
      } else {
        document.getElementById('ta-daily-chart').parentElement.innerHTML = emptyState('Noch keine Daten.');
      }

      if (byCategory.length > 0) {
        Charts.donutChart('ta-cat-chart', byCategory.map(r => r.category), byCategory.map(r => r.count));
      } else {
        document.getElementById('ta-cat-chart').parentElement.innerHTML = emptyState('Keine Kategoriedaten.');
      }
    } catch (err) {
      document.getElementById('ta-stats').innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 4: Create analytics-growth.js**

Create `dashboard/public/js/pages/analytics-growth.js`:

```javascript
// dashboard/public/js/pages/analytics-growth.js
window['page-analytics-growth'] = {
  period: '30d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Wachstum Analytics</h1><p>Aggregierte Join/Leave-Statistiken — keine personenbezogenen Daten.</p></div>
      <div id="gr-period"></div>
      <div id="gr-stats" class="stat-grid"></div>
      <div class="chart-card" style="margin-top:1rem"><div class="card-title" style="margin-bottom:.75rem">Joins & Leaves pro Tag</div><div style="height:250px"><canvas id="gr-chart"></canvas></div></div>
    `;
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(); });
    document.getElementById('gr-period').replaceWith(pb); pb.id = 'gr-period';
    await self.load();
  },

  async load() {
    try {
      const { data } = await API.growth(this.period);
      const { byDay } = data;
      const joins  = byDay.reduce((a, r) => a + r.joins, 0);
      const leaves = byDay.reduce((a, r) => a + r.leaves, 0);

      document.getElementById('gr-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Joins</div><div class="stat-value" style="color:var(--online)">${fmt(joins)}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Leaves</div><div class="stat-value" style="color:var(--offline)">${fmt(leaves)}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Netto</div><div class="stat-value" style="color:${joins-leaves>=0?'var(--online)':'var(--offline)'}">${joins-leaves>=0?'+':''}${joins-leaves}</div><div class="stat-sub">Wachstum</div></div>
      `;

      if (byDay.length > 0) {
        Charts.lineChart('gr-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [
          { label: 'Joins',  data: byDay.map(r => r.joins),  borderColor: '#57f287', backgroundColor: 'rgba(87,242,135,0.08)', tension: 0.3, fill: true },
          { label: 'Leaves', data: byDay.map(r => r.leaves), borderColor: '#ed4245', backgroundColor: 'rgba(237,66,69,0.08)',  tension: 0.3, fill: true },
        ]);
        // Enable legend for this multi-dataset chart
        const chart = Chart.getChart('gr-chart');
        if (chart) { chart.options.plugins.legend.display = true; chart.update(); }
      } else {
        document.getElementById('gr-chart').parentElement.innerHTML = emptyState('Noch keine Wachstumsdaten. Mitglieder-Events werden ab jetzt aufgezeichnet.');
      }
    } catch (err) {
      document.getElementById('gr-stats').innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 5: Create analytics-ai.js**

Create `dashboard/public/js/pages/analytics-ai.js`:

```javascript
// dashboard/public/js/pages/analytics-ai.js
window['page-analytics-ai'] = {
  period: '7d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>AI Usage Analytics</h1><p>Aggregierte KI-Nutzung — keine Prompt-Inhalte gespeichert.</p></div>
      <div id="ai-period"></div>
      <div id="ai-stats" class="stat-grid"></div>
      <div class="grid-2" style="margin-top:1rem">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Requests pro Tag</div><div style="height:220px"><canvas id="ai-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nach Feature</div><div style="height:220px"><canvas id="ai-feat-chart"></canvas></div></div>
      </div>
      <div class="card" style="margin-top:1rem">
        <div class="card-title" style="margin-bottom:.75rem">Feature-Aufschlüsselung</div>
        <div id="ai-table"></div>
      </div>
    `;
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(); });
    document.getElementById('ai-period').replaceWith(pb); pb.id = 'ai-period';
    await self.load();
  },

  async load() {
    try {
      const { data } = await API.ai(this.period);
      const { byFeature, byDay, total } = data;
      const successes = byFeature.reduce((a,r) => a + r.successes, 0);

      document.getElementById('ai-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Requests</div><div class="stat-value">${fmt(total)}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Erfolgsrate</div><div class="stat-value">${total > 0 ? Math.round(successes/total*100) : 0}%</div><div class="stat-sub">success</div></div>
        <div class="stat-card"><div class="stat-label">Features</div><div class="stat-value">${byFeature.length}</div><div class="stat-sub">aktiv</div></div>
      `;

      if (byDay.length > 0) {
        Charts.lineChart('ai-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)),
          [{ label: 'Requests', data: byDay.map(r => r.total), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]);
      } else {
        document.getElementById('ai-daily-chart').parentElement.innerHTML = emptyState('Noch keine AI-Daten.');
      }

      if (byFeature.length > 0) {
        Charts.donutChart('ai-feat-chart', byFeature.map(r => r.feature), byFeature.map(r => r.total));
        document.getElementById('ai-table').innerHTML = `
          <div class="table-wrap"><table>
            <thead><tr><th>Feature</th><th>Total</th><th>Erfolge</th><th>Fehler</th><th>Ø Dauer</th></tr></thead>
            <tbody>${byFeature.map(r => `
              <tr>
                <td class="mono">${r.feature}</td>
                <td>${r.total}</td>
                <td style="color:var(--online)">${r.successes}</td>
                <td style="color:${r.errors>0?'var(--offline)':'var(--text-muted)'}">${r.errors}</td>
                <td class="mono dim">${r.avg_duration_ms ? r.avg_duration_ms+'ms' : '—'}</td>
              </tr>
            `).join('')}</tbody>
          </table></div>
        `;
      } else {
        document.getElementById('ai-feat-chart').parentElement.innerHTML = emptyState('Keine AI-Features aktiv.');
        document.getElementById('ai-table').innerHTML = emptyState('Noch keine AI-Daten vorhanden.');
      }
    } catch (err) {
      document.getElementById('ai-stats').innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 6: Create analytics-status.js**

Create `dashboard/public/js/pages/analytics-status.js`:

```javascript
// dashboard/public/js/pages/analytics-status.js
window['page-analytics-status'] = {
  period: '7d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Serverstatus Analytics</h1><p>SCUM-Server-Verfügbarkeit und Spielerzahlen im Zeitverlauf.</p></div>
      <div id="ss-period"></div>
      <div id="ss-stats" class="stat-grid"></div>
      <div class="chart-card" style="margin-top:1rem"><div class="card-title" style="margin-bottom:.75rem">Spieler online (Verlauf)</div><div style="height:250px"><canvas id="ss-players-chart"></canvas></div></div>
    `;
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(); });
    document.getElementById('ss-period').replaceWith(pb); pb.id = 'ss-period';
    await self.load();
  },

  async load() {
    try {
      const { data } = await API.statusHistory(this.period);
      const { history, peak, uptimePct } = data;

      document.getElementById('ss-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value">${uptimePct !== null ? uptimePct+'%' : '—'}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Peak Spieler</div><div class="stat-value">${peak ?? '—'}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Checks</div><div class="stat-value">${fmt(history.length)}</div><div class="stat-sub">Status-Abfragen</div></div>
      `;

      const onlineHistory = history.filter(r => r.online === 1);
      if (onlineHistory.length > 0) {
        // Sample down to max 200 points for chart
        const step = Math.max(1, Math.floor(history.length / 200));
        const sampled = history.filter((_, i) => i % step === 0);
        Charts.lineChart('ss-players-chart',
          sampled.map(r => {
            const d = new Date(r.checked_at * 1000);
            return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
          }),
          [{ label: 'Spieler', data: sampled.map(r => r.players_online ?? 0), borderColor: '#57f287', backgroundColor: 'rgba(87,242,135,0.08)', tension: 0.2, fill: true, pointRadius: 0 }]
        );
      } else {
        document.getElementById('ss-players-chart').parentElement.innerHTML = emptyState('Noch keine Verlaufsdaten. Status wird bei jedem Check gespeichert.');
      }
    } catch (err) {
      document.getElementById('ss-stats').innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 7: Commit all analytics pages**

```
git add dashboard/public/js/pages/
git commit -m "feat(frontend): analytics pages (messages, voice, tickets, growth, AI, server status)"
```

---

### Task 8: Create Management Pages

**Files:**
- Create: `dashboard/public/js/pages/tickets.js`
- Create: `dashboard/public/js/pages/members.js`
- Create: `dashboard/public/js/pages/server-status.js`

- [ ] **Step 1: Create tickets.js**

Create `dashboard/public/js/pages/tickets.js`:

```javascript
// dashboard/public/js/pages/tickets.js
window['page-tickets'] = {
  state: { status: 'closed', page: 1, search: '' },
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Ticket-Verwaltung</h1><p>Alle Tickets durchsuchen, filtern und Details anzeigen.</p></div>
      <div style="display:flex;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
        <div class="period-bar">
          ${['open','closed','all'].map(s => `<button class="period-btn${s===self.state.status?' active':''}" data-status="${s}">${s==='open'?'Offen':s==='closed'?'Geschlossen':'Alle'}</button>`).join('')}
        </div>
        <input class="form-input" style="max-width:240px" placeholder="Suche..." id="ticket-search" value="${self.state.search}">
      </div>
      <div class="card" id="ticket-table-wrap"><div class="skeleton tall"></div></div>
      <div id="ticket-pagination" style="margin-top:.75rem;display:flex;gap:.5rem"></div>
    `;

    container.querySelectorAll('[data-status]').forEach(btn => {
      btn.addEventListener('click', () => {
        self.state.status = btn.dataset.status; self.state.page = 1;
        container.querySelectorAll('[data-status]').forEach(b => b.classList.toggle('active', b.dataset.status === self.state.status));
        self.load();
      });
    });

    let searchTimeout;
    document.getElementById('ticket-search').addEventListener('input', (e) => {
      clearTimeout(searchTimeout);
      searchTimeout = setTimeout(() => { self.state.search = e.target.value; self.state.page = 1; self.load(); }, 400);
    });

    await self.load();
  },

  async load() {
    const wrap = document.getElementById('ticket-table-wrap');
    if (!wrap) return;
    wrap.innerHTML = '<div class="skeleton tall"></div>';
    try {
      const { data } = await API.tickets({ status: this.state.status, page: this.state.page, search: this.state.search });
      const { tickets, total, pages } = data;

      if (tickets.length === 0) { wrap.innerHTML = emptyState('Keine Tickets gefunden.'); return; }

      wrap.innerHTML = `
        <div class="table-wrap"><table>
          <thead><tr><th>#</th><th>Kategorie</th><th>Status</th><th>Erstellt</th><th>Geschlossen</th><th>Bearbeiter</th><th>Zusammenfassung</th></tr></thead>
          <tbody>${tickets.map(t => `
            <tr style="cursor:pointer" onclick="window['page-tickets'].showDetail(${t.id})">
              <td class="mono dim">${t.id}</td>
              <td>${t.category}</td>
              <td><span class="badge ${t.status==='open'?'badge-warning':'badge-neutral'}">${t.status}</span></td>
              <td class="dim">${fmtDate(t.created_at)}</td>
              <td class="dim">${t.closed_at ? fmtDate(t.closed_at) : '—'}</td>
              <td class="dim">${t.closed_by_username_snapshot ?? '—'}</td>
              <td style="max-width:300px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;font-size:.78rem;color:var(--text-muted)">${t.summary ? t.summary.slice(0,120)+'…' : '—'}</td>
            </tr>
          `).join('')}</tbody>
        </table></div>
        <div style="padding:.75rem 0;font-size:.78rem;color:var(--text-muted)">${total} Tickets gesamt</div>
      `;

      // Pagination
      const pgEl = document.getElementById('ticket-pagination');
      pgEl.innerHTML = '';
      if (pages > 1) {
        for (let i = 1; i <= Math.min(pages, 10); i++) {
          const btn = document.createElement('button');
          btn.className = `period-btn${i === this.state.page ? ' active' : ''}`;
          btn.textContent = i;
          btn.addEventListener('click', () => { this.state.page = i; this.load(); });
          pgEl.appendChild(btn);
        }
      }
    } catch (err) { wrap.innerHTML = errorState(err.message); }
  },

  async showDetail(id) {
    try {
      const { data: t } = await API.ticket(id);
      const modal = document.createElement('div');
      modal.style.cssText = 'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:999;display:flex;align-items:center;justify-content:center;padding:1rem';
      modal.innerHTML = `
        <div style="background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-lg);padding:1.5rem;max-width:600px;width:100%;max-height:80vh;overflow-y:auto">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:1rem">
            <h2 style="font-size:1rem;margin:0">Ticket #${t.id} — ${t.category}</h2>
            <button onclick="this.closest('[style]').remove()" class="btn btn-ghost" style="padding:.2rem .5rem">✕</button>
          </div>
          <table style="width:100%;font-size:.82rem;margin-bottom:1rem">
            <tr><td style="color:var(--text-muted);padding:.3rem 0;width:40%">Status</td><td><span class="badge ${t.status==='open'?'badge-warning':'badge-neutral'}">${t.status}</span></td></tr>
            <tr><td style="color:var(--text-muted);padding:.3rem 0">Erstellt</td><td>${fmtDate(t.created_at)}</td></tr>
            <tr><td style="color:var(--text-muted);padding:.3rem 0">Geschlossen</td><td>${t.closed_at ? fmtDate(t.closed_at) : '—'}</td></tr>
            <tr><td style="color:var(--text-muted);padding:.3rem 0">Nachrichten</td><td>${t.message_count ?? '—'}</td></tr>
            <tr><td style="color:var(--text-muted);padding:.3rem 0">Bearbeiter</td><td>${t.closed_by_username_snapshot ?? '—'}</td></tr>
          </table>
          ${t.summary ? `<div style="background:var(--surface-raised);border-radius:6px;padding:1rem;font-size:.82rem;line-height:1.6;color:var(--text-secondary)">${t.summary}</div>` : '<p style="color:var(--text-muted);font-size:.82rem">Keine Zusammenfassung verfügbar.</p>'}
        </div>
      `;
      modal.addEventListener('click', (e) => { if (e.target === modal) modal.remove(); });
      document.body.appendChild(modal);
    } catch (err) { toast('Ticket konnte nicht geladen werden: ' + err.message, 'error'); }
  },
};
```

- [ ] **Step 2: Create members.js**

Create `dashboard/public/js/pages/members.js`:

```javascript
// dashboard/public/js/pages/members.js
window['page-members'] = {
  search: '',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Mitglieder</h1><p>Mitgliederliste — keine Aktivitätsranglisten, nur Verwaltungsdaten.</p></div>
      <div style="margin-bottom:1rem">
        <input class="form-input" style="max-width:280px" placeholder="Nach Name suchen..." id="member-search">
      </div>
      <div class="card" id="member-table-wrap"><div class="skeleton tall"></div></div>
    `;

    let members = [];
    let timeout;
    document.getElementById('member-search').addEventListener('input', (e) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => {
        self.search = e.target.value.toLowerCase();
        self.renderTable(members);
      }, 200);
    });

    try {
      const { data } = await API.members();
      members = data.members;
      self.renderTable(members);
    } catch (err) {
      document.getElementById('member-table-wrap').innerHTML = errorState(err.message);
    }
  },

  renderTable(members) {
    const filtered = this.search
      ? members.filter(m => (m.displayName ?? m.username).toLowerCase().includes(this.search))
      : members;
    const wrap = document.getElementById('member-table-wrap');
    if (!wrap) return;
    if (filtered.length === 0) { wrap.innerHTML = emptyState('Keine Mitglieder gefunden.'); return; }
    wrap.innerHTML = `
      <div style="font-size:.78rem;color:var(--text-muted);margin-bottom:.75rem">${filtered.length} Mitglieder</div>
      <div class="table-wrap"><table>
        <thead><tr><th>Name</th><th>Discord-ID</th><th>Beigetreten</th><th>Rollen</th><th>Tickets</th></tr></thead>
        <tbody>${filtered.slice(0, 200).map(m => `
          <tr>
            <td>
              <div style="display:flex;align-items:center;gap:.5rem">
                <img src="${m.avatar}" style="width:24px;height:24px;border-radius:50%;background:var(--surface-raised)" onerror="this.style.display='none'">
                <span>${m.displayName ?? m.username}</span>
              </div>
            </td>
            <td class="mono dim" style="font-size:.75rem">${m.id}</td>
            <td class="dim">${m.joinedAt ? fmtDate(m.joinedAt / 1000) : '—'}</td>
            <td style="font-size:.75rem">${m.roles.slice(0,3).map(r => `<span class="badge badge-neutral" style="margin-right:.2rem">${r.name}</span>`).join('')}${m.roles.length > 3 ? `<span class="dim">+${m.roles.length-3}</span>` : ''}</td>
            <td class="dim">${m.ticketCount}</td>
          </tr>
        `).join('')}</tbody>
      </table></div>
      ${filtered.length > 200 ? `<p style="font-size:.78rem;color:var(--text-muted);margin-top:.5rem">Zeige 200 von ${filtered.length}. Suche verfeinern um mehr zu sehen.</p>` : ''}
    `;
  },
};
```

- [ ] **Step 3: Create server-status.js**

Create `dashboard/public/js/pages/server-status.js`:

```javascript
// dashboard/public/js/pages/server-status.js
window['page-server-status'] = {
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Server Status</h1><p>Live-Statuscheck des SCUM-Servers.</p></div>
      <div id="ss-live"><div class="skeleton tall"></div></div>
    `;
    await self.load();
  },

  async load() {
    try {
      const { data: config } = await API.serverStatus();
      document.getElementById('ss-live').innerHTML = config ? `
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-label">Adresse</div><div class="stat-value mono" style="font-size:1rem">${config.host ?? '—'}</div><div class="stat-sub">Port: ${config.query_port ?? '—'}</div></div>
          <div class="stat-card"><div class="stat-label">Aktiv</div><div class="stat-value">${config.enabled ? '<span style="color:var(--online)">Ja</span>' : '<span style="color:var(--offline)">Nein</span>'}</div></div>
          <div class="stat-card"><div class="stat-label">Intervall</div><div class="stat-value mono" style="font-size:1rem">${config.update_interval_secs}s</div></div>
        </div>
        <div style="margin-top:1rem">
          <button class="btn btn-primary" id="test-btn">▶ Status jetzt testen</button>
        </div>
        <div id="test-result" style="margin-top:1rem"></div>
      ` : emptyState('Server noch nicht konfiguriert. Gehe zu Einstellungen → Server Status.');

      document.getElementById('test-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('test-btn');
        const resultEl = document.getElementById('test-result');
        btn.disabled = true; btn.textContent = '⏳ Teste...';
        try {
          const { data } = await API.testStatus();
          if (data.online) {
            resultEl.innerHTML = `<div class="card"><span class="badge badge-online">Online</span> &nbsp; Spieler: <strong>${data.players}/${data.maxPlayers}</strong> &nbsp; Ping: <strong>${data.ping ?? '—'}ms</strong></div>`;
            toast('Server online!', 'success');
          } else {
            resultEl.innerHTML = `<div class="card"><span class="badge badge-offline">Offline</span></div>`;
            toast('Server nicht erreichbar.', 'error');
          }
        } catch (err) {
          resultEl.innerHTML = errorState(err.message);
        } finally {
          btn.disabled = false; btn.textContent = '▶ Status jetzt testen';
        }
      });
    } catch (err) {
      document.getElementById('ss-live').innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 4: Commit**

```
git add dashboard/public/js/pages/tickets.js dashboard/public/js/pages/members.js dashboard/public/js/pages/server-status.js
git commit -m "feat(frontend): tickets, members, server-status pages"
```

---

### Task 9: Create Logs and AI Pages

**Files:**
- Create: `dashboard/public/js/pages/logs.js`
- Create: `dashboard/public/js/pages/ai.js`

- [ ] **Step 1: Create logs.js**

Create `dashboard/public/js/pages/logs.js`:

```javascript
// dashboard/public/js/pages/logs.js
window['page-logs'] = {
  eventSource: null,
  async render(container) {
    const self = this;
    if (self.eventSource) { self.eventSource.close(); self.eventSource = null; }

    container.innerHTML = `
      <div class="page-header"><h1>Logs</h1><p>Bot-Logs und Dashboard Audit-Trail.</p></div>
      <div class="tab-bar">
        <button class="tab-btn active" data-tab="live">Live-Logs</button>
        <button class="tab-btn" data-tab="audit">Audit-Trail</button>
      </div>
      <div id="log-tab-live">
        <div style="display:flex;gap:.75rem;margin-bottom:1rem;flex-wrap:wrap">
          <select class="form-input" style="width:auto" id="log-level-filter">
            <option value="">Alle Level</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <label style="display:flex;align-items:center;gap:.4rem;font-size:.82rem;color:var(--text-secondary)">
            <input type="checkbox" id="log-live-toggle" checked> Live-Stream
          </label>
        </div>
        <div class="card" style="font-family:var(--mono);font-size:.72rem;max-height:500px;overflow-y:auto" id="log-output">
          <div class="skeleton"></div>
        </div>
      </div>
      <div id="log-tab-audit" style="display:none">
        <div class="card" id="audit-output"><div class="skeleton tall"></div></div>
      </div>
    `;

    // Tab switching
    container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b === btn));
        document.getElementById('log-tab-live').style.display  = btn.dataset.tab === 'live'  ? '' : 'none';
        document.getElementById('log-tab-audit').style.display = btn.dataset.tab === 'audit' ? '' : 'none';
        if (btn.dataset.tab === 'audit') self.loadAudit();
      });
    });

    // Load initial log snapshot
    try {
      const { data: logs } = await API.logs({ level: '' });
      self.renderLogs(logs);
    } catch (err) {
      document.getElementById('log-output').innerHTML = errorState(err.message);
    }

    // Start SSE stream
    self.startStream();

    document.getElementById('log-live-toggle').addEventListener('change', (e) => {
      if (e.target.checked) self.startStream(); else self.stopStream();
    });
  },

  startStream() {
    if (this.eventSource) return;
    this.eventSource = new EventSource('/api/logs/stream', { withCredentials: true });
    this.eventSource.onmessage = (e) => {
      const entries = JSON.parse(e.data);
      if (entries.length > 0) this.appendLogs(entries);
    };
    this.eventSource.onerror = () => { this.stopStream(); };
  },

  stopStream() {
    if (this.eventSource) { this.eventSource.close(); this.eventSource = null; }
  },

  renderLogs(entries) {
    const out = document.getElementById('log-output');
    if (!out) return;
    out.innerHTML = entries.length === 0 ? emptyState('Keine Logs.') :
      entries.map(e => this.logLine(e)).join('');
    out.scrollTop = out.scrollHeight;
  },

  appendLogs(entries) {
    const out = document.getElementById('log-output');
    const filter = document.getElementById('log-level-filter')?.value ?? '';
    if (!out) return;
    const filtered = filter ? entries.filter(e => e.level === filter) : entries;
    filtered.forEach(e => {
      const div = document.createElement('div');
      div.innerHTML = this.logLine(e);
      out.appendChild(div.firstChild);
    });
    // Keep max 500 lines in DOM
    while (out.children.length > 500) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
  },

  logLine(e) {
    const colors = { info: 'var(--text-secondary)', warn: 'var(--warning)', error: 'var(--offline)', debug: 'var(--text-muted)' };
    return `<div style="padding:.15rem 0;color:${colors[e.level]??'var(--text-secondary)'}"><span style="color:var(--text-muted)">${e.ts.slice(11,19)}</span> <span style="font-weight:600">[${e.level.toUpperCase()}]</span> ${e.message.replace(/</g,'&lt;')}</div>`;
  },

  async loadAudit() {
    try {
      const { data } = await API.auditLogs();
      const out = document.getElementById('audit-output');
      if (data.length === 0) { out.innerHTML = emptyState('Noch keine Audit-Einträge.'); return; }
      out.innerHTML = `
        <div class="table-wrap"><table>
          <thead><tr><th>Zeit</th><th>Admin</th><th>Aktion</th><th>Status</th></tr></thead>
          <tbody>${data.map(r => `
            <tr>
              <td class="dim mono" style="font-size:.75rem">${fmtDate(r.created_at)}</td>
              <td class="dim mono" style="font-size:.75rem">${r.admin_user_id.slice(0,8)}…</td>
              <td class="mono" style="font-size:.78rem">${r.action}</td>
              <td><span class="badge ${r.success?'badge-online':'badge-offline'}">${r.success?'OK':'Fehler'}</span></td>
            </tr>
          `).join('')}</tbody>
        </table></div>
      `;
    } catch (err) {
      document.getElementById('audit-output').innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 2: Create ai.js**

Create `dashboard/public/js/pages/ai.js`:

```javascript
// dashboard/public/js/pages/ai.js
window['page-ai'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><h1>AI</h1><p>KI-Features und aggregierte Nutzungsübersicht — keine Prompt-Inhalte.</p></div>
      <div id="ai-overview"><div class="skeleton tall"></div></div>
    `;

    try {
      const [{ data: ai7d }, { data: ai24h }] = await Promise.all([API.ai('7d'), API.ai('24h')]);
      const features7d = ai7d.byFeature;
      const successes  = features7d.reduce((a,r) => a+r.successes, 0);
      const errors     = features7d.reduce((a,r) => a+r.errors, 0);

      document.getElementById('ai-overview').innerHTML = `
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-label">24h Requests</div><div class="stat-value">${fmt(ai24h.total)}</div></div>
          <div class="stat-card"><div class="stat-label">7d Requests</div><div class="stat-value">${fmt(ai7d.total)}</div></div>
          <div class="stat-card"><div class="stat-label">Erfolgsrate</div><div class="stat-value">${ai7d.total > 0 ? Math.round(successes/(successes+errors)*100) : 0}%</div><div class="stat-sub">7 Tage</div></div>
          <div class="stat-card"><div class="stat-label">Fehler 7d</div><div class="stat-value" style="color:${errors>0?'var(--offline)':'var(--online)'}">${fmt(errors)}</div></div>
        </div>
        <div class="card" style="margin-top:1rem">
          <div class="card-title" style="margin-bottom:.75rem">Aktive Features (7 Tage)</div>
          ${features7d.length === 0 ? emptyState('Noch keine AI-Nutzung aufgezeichnet.') : `
            <div class="table-wrap"><table>
              <thead><tr><th>Feature</th><th>Requests</th><th>Erfolge</th><th>Fehler</th><th>Ø Dauer</th></tr></thead>
              <tbody>${features7d.map(r => `
                <tr>
                  <td class="mono">${r.feature}</td>
                  <td>${r.total}</td>
                  <td style="color:var(--online)">${r.successes}</td>
                  <td style="color:${r.errors>0?'var(--offline)':'var(--text-muted)'}">${r.errors}</td>
                  <td class="mono dim">${r.avg_duration_ms ? r.avg_duration_ms+'ms' : '—'}</td>
                </tr>
              `).join('')}</tbody>
            </table></div>
          `}
        </div>
        <div class="card" style="margin-top:1rem">
          <div class="card-title" style="margin-bottom:.5rem">Hinweis</div>
          <p style="font-size:.82rem;color:var(--text-secondary)">API-Keys werden niemals im Dashboard angezeigt oder geloggt. Prompt-Inhalte werden nicht gespeichert. Nur aggregierte Metadaten (Feature, Dauer, Erfolg/Fehler) sind sichtbar.</p>
        </div>
      `;
    } catch (err) {
      document.getElementById('ai-overview').innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 3: Commit**

```
git add dashboard/public/js/pages/logs.js dashboard/public/js/pages/ai.js
git commit -m "feat(frontend): logs (SSE stream + audit) and AI pages"
```

---

### Task 10: Create Settings Page

**Files:**
- Create: `dashboard/public/js/pages/settings.js`

- [ ] **Step 1: Create the file**

Create `dashboard/public/js/pages/settings.js`:

```javascript
// dashboard/public/js/pages/settings.js
window['page-settings'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><h1>Einstellungen</h1><p>Bot- und System-Konfiguration. Secrets werden niemals angezeigt.</p></div>
      <div id="settings-content"><div class="skeleton tall"></div></div>
    `;

    try {
      const { data } = await API.settings();
      const { scumStatus } = data;

      document.getElementById('settings-content').innerHTML = `
        <!-- Server Status Settings -->
        <div class="card" style="margin-bottom:1rem">
          <div class="card-header"><div class="card-title">Server Status</div></div>
          <form id="form-scum">
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Server Host / IP</label>
                <input class="form-input" name="host" value="${scumStatus?.host ?? ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Query Port</label>
                <input class="form-input" type="number" name="query_port" value="${scumStatus?.query_port ?? ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Intervall (Sekunden)</label>
                <input class="form-input" type="number" name="update_interval_secs" value="${scumStatus?.update_interval_secs ?? 60}">
              </div>
              <div class="form-group">
                <label class="form-label">Aktiviert</label>
                <select class="form-input" name="enabled">
                  <option value="1" ${scumStatus?.enabled ? 'selected' : ''}>Ja</option>
                  <option value="0" ${!scumStatus?.enabled ? 'selected' : ''}>Nein</option>
                </select>
              </div>
            </div>
            <button type="submit" class="btn btn-primary">Speichern</button>
            <span id="scum-msg" style="margin-left:.75rem;font-size:.8rem"></span>
          </form>
        </div>

        <!-- Info card -->
        <div class="card">
          <div class="card-title" style="margin-bottom:.5rem">Weitere Einstellungen</div>
          <p style="font-size:.82rem;color:var(--text-secondary)">
            Weitere Einstellungen (Ticket-System, Streamer, AI, etc.) werden über die Discord-Slash-Commands
            <code style="font-family:var(--mono);font-size:.78rem;background:var(--surface-raised);padding:.1em .3em;border-radius:3px">/setup</code> und
            <code style="font-family:var(--mono);font-size:.78rem;background:var(--surface-raised);padding:.1em .3em;border-radius:3px">/config</code>
            konfiguriert. Secrets (API-Keys, Tokens) werden niemals im Dashboard angezeigt.
          </p>
        </div>
      `;

      document.getElementById('form-scum').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd   = new FormData(e.target);
        const body = { host: fd.get('host'), query_port: parseInt(fd.get('query_port')), update_interval_secs: parseInt(fd.get('update_interval_secs')), enabled: parseInt(fd.get('enabled')) };
        const msgEl = document.getElementById('scum-msg');
        try {
          await API.patch('/settings/scum', body);
          msgEl.textContent = '✓ Gespeichert';
          msgEl.style.color = 'var(--online)';
          toast('Einstellungen gespeichert.', 'success');
        } catch (err) {
          msgEl.textContent = '✕ Fehler: ' + err.message;
          msgEl.style.color = 'var(--offline)';
        }
        setTimeout(() => { msgEl.textContent = ''; }, 3000);
      });
    } catch (err) {
      document.getElementById('settings-content').innerHTML = errorState(err.message);
    }
  },
};
```

- [ ] **Step 2: Commit**

```
git add dashboard/public/js/pages/settings.js
git commit -m "feat(frontend): settings page with server status config form"
```

---

### Task 11: End-to-End Verification

- [ ] **Step 1: Build bot and start**

```
npm run build
pm2 restart scum-bot
```

- [ ] **Step 2: Verify all pages load**

Open `http://localhost:3000` in browser. After Discord login:

Check each page loads without JavaScript errors (open DevTools Console):
- `#/overview` — KPI cards appear (or empty states if no data)
- `#/analytics-messages` — Period bar + empty state or chart
- `#/analytics-voice` — Period bar + empty state or chart
- `#/analytics-tickets` — Stats + charts
- `#/analytics-growth` — Growth chart or empty state
- `#/analytics-ai` — AI stats or empty state
- `#/analytics-status` — Status history or empty state
- `#/tickets` — Ticket table
- `#/members` — Member list
- `#/server-status` — Status card + test button
- `#/logs` — Log output + SSE stream
- `#/ai` — AI overview
- `#/settings` — Settings form

- [ ] **Step 3: Verify SSE log stream**

Navigate to `#/logs`. Live-Stream checkbox should be checked. New log lines should appear every few seconds when bot activity occurs.

- [ ] **Step 4: Verify Test Status button**

Navigate to `#/server-status`. Click "Status jetzt testen". Should return online/offline result within 5 seconds.

- [ ] **Step 5: Verify auth protection**

Open incognito window, go to `http://localhost:3000`. Should redirect to `/login.html`.

Try `http://localhost:3000/api/overview` — should return `{"success":false,"error":"Not authenticated"}`.

- [ ] **Step 6: Verify responsive layout**

Resize browser to 768px wide. Sidebar should stack or collapse.

- [ ] **Step 7: Final commit**

```
git add -A
git commit -m "feat(dashboard): complete Phase 1 frontend — all pages implemented"
```

---

## Self-Review Checklist

- [x] Spec section 12 (UI/UX): DashboardLayout ✅, Sidebar ✅, Topbar ✅, StatCard ✅, ChartCard ✅, DataTable ✅, FilterBar ✅, EmptyState ✅, LoadingState ✅, Toast ✅
- [x] Spec section 13 (Sektor 13 style): Dark background ✅, accent red ✅, monospace values ✅, professional clean ✅, no emoji overload ✅
- [x] Spec section 2 (Overview): All KPI cards ✅, server status ✅, ticket counts ✅, activity ✅
- [x] Spec section 3.2 (Messages): Chart by day ✅, chart by channel ✅, period selector ✅
- [x] Spec section 3.3 (Voice): Voice time chart ✅, channel breakdown ✅, stream total ✅
- [x] Spec section 3.8 (Ticket Analytics): Volume chart ✅, by-category donut ✅, avg resolution ✅
- [x] Spec section 3.10 (Growth): Join/leave chart ✅, net growth ✅
- [x] Spec section 3.11 (Bot Usage): Commands table via analytics-commands (loaded separately from overview page) ✅
- [x] Spec section 3.12 (AI): Feature breakdown ✅, daily chart ✅, no prompt content ✅
- [x] Spec section 3.13 (Server Status): Player history chart ✅, uptime % ✅, peak ✅
- [x] Spec section 5 (Tickets): Filterable table ✅, detail modal ✅, summary display ✅
- [x] Spec section 6 (Logs): Log viewer ✅, SSE stream ✅, audit trail ✅
- [x] Spec section 7 (Members): Member table ✅, no activity rankings ✅, ticket count enrichment ✅
- [x] Spec section 8 (Server Status): Live test button ✅, config display ✅
- [x] Spec section 9 (AI page): Feature table ✅, no API key display ✅, privacy note ✅
- [x] Privacy: No user activity rankings in any page ✅, voice_session_temp not exposed ✅, no prompt contents ✅, no API keys shown ✅
- [x] Empty states: Every page handles empty data gracefully ✅
- [x] Error states: Every fetch has try/catch with error display ✅
- [x] Auth redirect: api.js redirects to /login.html on 401 ✅
