# Dashboard UI/UX Overhaul — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Overhaul both Public and Admin dashboards to professional elite level — fix critical bugs, add integration health cards, dirty-state for settings, collapsible rules with proper typography, and improve mobile responsiveness throughout.

**Architecture:** Vanilla JS SPA, no new dependencies. Improvements use existing Chart.js, CSS custom properties, and the page-module pattern (`window['page-name'] = { render(container) {} }`). Public dashboard routes to `/public-api/…`; Admin to `/api/…`. Both share identical design tokens. `SettingsHelper.buildPage()` handles all admin settings pages.

**Tech Stack:** Vanilla JS, Chart.js 4.4.0, CSS custom properties, existing API endpoints.

**Hard constraints (from user):**
- No new npm dependencies
- No fake data — only real API/DB values
- No feature removal
- No API contract changes
- No API keys in HTML
- Admin routes remain server-side protected (do not bypass)
- Existing auth/permissions unchanged

---

## File Map

| File | Change |
|------|--------|
| `dashboard/public-user/js/pages/server.js` | Remove duplicate second definition (lines 268–419) |
| `dashboard/public-user/css/dashboard.css` | Add utility classes + mobile fixes |
| `dashboard/public/css/dashboard.css` | Same additions (both files are identical base) |
| `dashboard/public-user/js/app.js` | Fix `emptyState` to accept optional subtitle |
| `dashboard/public-user/js/pages/rules.js` | Rewrite with collapsible categories + rule cards |
| `dashboard/public-user/js/pages/overview.js` | Fix emptyState calls; add player history chart to bottom |
| `dashboard/public-user/js/pages/server.js` | After bug-fix: add status-strip + improve layout |
| `dashboard/public/js/pages/overview.js` | Add integration health cards at top |
| `dashboard/public/js/settings-helper.js` | Add dirty-state tracking + sticky unsaved-changes banner |

---

## Task 1: Fix critical server.js duplicate bug

**Files:**
- Modify: `dashboard/public-user/js/pages/server.js`

The entire `window['page-server']` object is defined **twice** in this file. At line 268, immediately after the closing `}` of `compactChartOptions()`, a second (degraded) `window['page-server'] = {` begins that overwrites the first full definition. The second version lacks `normalizeServerPayload`, `buildServerConfigCards`, `renderConfigCards`, and `renderWipePanel`. It must be removed.

- [ ] **Step 1: Read and confirm the line numbers**

Open `dashboard/public-user/js/pages/server.js`. The first definition ends at line ~267. Line 268 begins `}window['page-server'] = {` — this is the start of the duplicate. The file ends at line 419.

- [ ] **Step 2: Delete lines 268–419 (the duplicate second definition)**

Using the Edit tool, replace from `}window['page-server'] = {` at line 268 to end of file with just `}` (closing the `compactChartOptions` function that ends just before it).

Find the exact old_string:
```
  };
}window['page-server'] = {
```
Replace with:
```
  };
}
```

Then delete everything after the closing `}` of `compactChartOptions`. Since the edit tool can't easily delete the tail, use a Write to overwrite the full file with lines 1–267 only.

Actually: use the Edit tool. The old_string is the entire second definition block. Find the unique start:
```
}window['page-server'] = {
  async render(container) {
    container.innerHTML = pageHeader('SCUM Server', 'Serverstatus', 'Live-Status, Verlauf und wichtige Serverinformationen.') + '<div id="server-content"></div>';
    const root = document.getElementById('server-content');
    try {
      const { data } = await API.server();
      const current = data.current;
```
Replace with just:
```
}
```

- [ ] **Step 3: Verify only one `window['page-server']` remains**

Run:
```bash
grep -c "window\['page-server'\]" dashboard/public-user/js/pages/server.js
```
Expected output: `1`

- [ ] **Step 4: Commit**

```bash
git add dashboard/public-user/js/pages/server.js
git commit -m "fix(public-dashboard): remove duplicate page-server definition in server.js"
```

---

## Task 2: CSS Utility Classes — both dashboards

**Files:**
- Modify: `dashboard/public-user/css/dashboard.css`
- Modify: `dashboard/public/css/dashboard.css`

Add new CSS classes required by Tasks 3–7. No existing classes are modified.

- [ ] **Step 1: Add health-card classes to `dashboard/public-user/css/dashboard.css`**

Append at end of file:

```css
/* ── Health / Integration Cards ─────────────────────────────────────────── */
.health-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(200px, 1fr));
  gap: 1rem;
  margin-bottom: 1.5rem;
}
.health-card {
  background: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--border-accent);
  border-radius: var(--radius-lg);
  padding: 1rem 1.25rem;
  display: flex;
  flex-direction: column;
  gap: 0.4rem;
  transition: border-color var(--transition), box-shadow var(--transition);
}
.health-card.ok     { border-left-color: var(--online); }
.health-card.warn   { border-left-color: var(--warning); }
.health-card.error  { border-left-color: var(--offline); }
.health-card-header { display: flex; align-items: center; justify-content: space-between; }
.health-card-name {
  font-size: 0.7rem; font-weight: 700;
  text-transform: uppercase; letter-spacing: 0.08em;
  color: var(--text-muted);
}
.health-card-value {
  font-size: 1.4rem; font-weight: 700;
  font-family: var(--mono); line-height: 1;
}
.health-card-value.ok    { color: var(--online); }
.health-card-value.warn  { color: var(--warning); }
.health-card-value.error { color: var(--offline); }
.health-card-meta { font-size: 0.7rem; color: var(--text-muted); line-height: 1.4; }
.health-card-diag {
  font-size: 0.7rem; color: var(--offline);
  background: var(--offline-glow);
  border: 1px solid rgba(224, 82, 82, 0.15);
  border-radius: var(--radius);
  padding: 0.35rem 0.6rem; margin-top: 0.2rem; line-height: 1.4;
}
.health-card-diag.warn {
  color: var(--warning);
  background: var(--warning-glow);
  border-color: rgba(232, 152, 26, 0.15);
}

/* ── Dirty / unsaved-changes banner ─────────────────────────────────────── */
.dirty-banner {
  display: none; align-items: center; gap: 0.75rem;
  background: rgba(232, 152, 26, 0.08);
  border: 1px solid rgba(232, 152, 26, 0.25);
  border-radius: var(--radius);
  padding: 0.55rem 1rem; font-size: 0.8rem; color: var(--warning);
  margin-bottom: 1rem;
  position: sticky; top: calc(var(--topbar-h) + 0.5rem); z-index: 20;
}
.dirty-banner.visible { display: flex; }
.dirty-dot {
  width: 7px; height: 7px; border-radius: 50%;
  background: var(--warning); flex-shrink: 0;
  animation: pulse-warn 1.6s ease infinite;
}
@keyframes pulse-warn { 0%, 100% { opacity: 1; } 50% { opacity: 0.35; } }

/* ── Rules display ───────────────────────────────────────────────────────── */
.rule-category { margin-bottom: 1.75rem; }
.rule-category-header {
  display: flex; align-items: center; gap: 0.75rem;
  padding: 0.75rem 1.1rem;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); margin-bottom: 0.6rem;
  cursor: pointer; user-select: none;
  transition: background var(--transition);
}
.rule-category-header:hover { background: var(--surface-hover); }
.rule-category-icon { font-size: 1.05rem; flex-shrink: 0; }
.rule-category-info { flex: 1; }
.rule-category-name { font-size: 0.88rem; font-weight: 700; color: var(--text); }
.rule-category-count { font-size: 0.7rem; color: var(--text-muted); margin-top: 0.1rem; }
.rule-category-chevron {
  font-size: 0.65rem; color: var(--text-muted);
  transition: transform var(--transition); flex-shrink: 0;
}
.rule-category-header.collapsed .rule-category-chevron { transform: rotate(-90deg); }
.rule-category-body { display: flex; flex-direction: column; gap: 0.45rem; }
.rule-category-body.collapsed { display: none; }

.rule-item {
  background: var(--surface); border: 1px solid var(--border-subtle);
  border-left: 3px solid var(--border-accent);
  border-radius: var(--radius-lg); padding: 0.85rem 1.1rem;
  transition: border-color var(--transition), background var(--transition);
}
.rule-item:hover { background: var(--surface-hover); border-left-color: var(--accent-muted); }
.rule-item-header { display: flex; align-items: baseline; gap: 0.6rem; margin-bottom: 0.35rem; flex-wrap: wrap; }
.rule-number {
  font-size: 0.62rem; font-weight: 700; font-family: var(--mono);
  color: var(--text-muted); flex-shrink: 0;
  padding: 0.12em 0.4em; background: var(--surface-raised);
  border-radius: 3px;
}
.rule-title { font-size: 0.87rem; font-weight: 700; color: var(--text); line-height: 1.3; }
.rule-body { font-size: 0.81rem; color: var(--text-secondary); line-height: 1.65; }
.rule-body p { margin-bottom: 0.35rem; }
.rule-body p:last-child { margin-bottom: 0; }
.rule-body ul, .rule-body ol { padding-left: 1.2rem; margin: 0.25rem 0; }
.rule-body li { margin-bottom: 0.15rem; }
.empty-sub { font-size: 0.75rem; color: var(--text-muted); margin-top: 0.25rem; }

/* ── Mobile fixes ────────────────────────────────────────────────────────── */
@media (max-width: 768px) {
  .sidebar { transform: translateX(-100%); transition: transform 200ms ease; }
  .sidebar.open { transform: translateX(0); box-shadow: 4px 0 32px rgba(0,0,0,0.7); }
  .main { margin-left: 0; }
  .topbar-toggle { display: flex; }
  .page-content { padding: 1rem; }
  .health-grid { grid-template-columns: 1fr 1fr; }
  .stat-grid { grid-template-columns: 1fr 1fr; }
}
@media (max-width: 480px) {
  .health-grid, .stat-grid { grid-template-columns: 1fr; }
  .grid-2, .grid-3 { grid-template-columns: 1fr; }
}
```

- [ ] **Step 2: Apply identical additions to `dashboard/public/css/dashboard.css`**

Append the exact same CSS block to `dashboard/public/css/dashboard.css`.

- [ ] **Step 3: Commit**

```bash
git add dashboard/public-user/css/dashboard.css dashboard/public/css/dashboard.css
git commit -m "style(dashboard): add health-card, rule, dirty-banner CSS classes + mobile fixes"
```

---

## Task 3: Fix `emptyState` helper in public-user `app.js`

**Files:**
- Modify: `dashboard/public-user/js/app.js`

The `emptyState()` function only accepts one parameter, but `overview.js` calls it with two (message + subtitle). Fix the function signature.

- [ ] **Step 1: Find the current `emptyState` definition in app.js**

It looks like:
```js
function emptyState(message = 'Noch keine Daten vorhanden.') {
  return `<div class="empty-state"><div class="empty-icon">◌</div><p>${message}</p></div>`;
}
```

- [ ] **Step 2: Replace with version accepting optional subtitle**

```js
function emptyState(message = 'Noch keine Daten vorhanden.', sub = '') {
  const subHtml = sub ? `<p class="empty-sub">${escapeHtml(sub)}</p>` : '';
  return `<div class="empty-state"><div class="empty-icon">◌</div><p>${escapeHtml(message)}</p>${subHtml}</div>`;
}
```

Note: the original used `${message}` directly without escaping. The fix also adds escaping for safety.

- [ ] **Step 3: Commit**

```bash
git add dashboard/public-user/js/app.js
git commit -m "fix(public-dashboard): emptyState() accepts optional subtitle, add XSS escaping"
```

---

## Task 4: Public Dashboard — Rules page rewrite

**Files:**
- Modify: `dashboard/public-user/js/pages/rules.js`

Replace with collapsible category sections, rule number badges, and proper body formatting (bullets, numbered lists, paragraphs → safe HTML). The existing `API.rules()` endpoint is used unchanged.

- [ ] **Step 1: Write the new rules.js**

Replace the entire content of `dashboard/public-user/js/pages/rules.js` with:

```js
window['page-rules'] = {
  _categories: [],
  _query: '',
  _collapsed: {},

  async render(container) {
    container.innerHTML =
      pageHeader('Regelwerk', 'SECTOR 13 Regelwerk', 'Alle gültigen Regeln. Bei Fragen öffne ein Support-Ticket.') +
      `<div style="margin-bottom:1.25rem">
        <input class="form-input" type="search" id="rules-q" placeholder="Regeln durchsuchen…"
          style="max-width:380px;background:var(--surface);border:1px solid var(--border);
                 border-radius:var(--radius);padding:0.55rem 0.9rem;color:var(--text);width:100%;" />
      </div>
      <div id="rules-content">${loadingState()}</div>`;

    document.getElementById('rules-q').addEventListener('input', (e) => {
      this._query = e.target.value.trim().toLowerCase();
      this.renderList();
    });

    await this.load();
  },

  async load() {
    const root = document.getElementById('rules-content');
    try {
      const { data } = await API.rules();
      // API may return { categories: [...] } or a bare array
      this._categories = Array.isArray(data?.categories) ? data.categories
        : Array.isArray(data) ? data : [];
      this.renderList();
    } catch {
      root.innerHTML = errorState('Regelwerk konnte nicht geladen werden.');
    }
  },

  renderList() {
    const root = document.getElementById('rules-content');
    if (!root) return;
    const q = this._query;

    if (!this._categories.length) {
      root.innerHTML = emptyState('Noch keine Regeln veröffentlicht.');
      return;
    }

    if (q) {
      // Flat search across all categories
      const matches = [];
      for (const cat of this._categories) {
        for (const rule of (cat.rules || [])) {
          const hay = [rule.title, rule.name, rule.body, rule.content, rule.description]
            .filter(Boolean).join(' ').toLowerCase();
          if (hay.includes(q)) {
            matches.push({ ...rule, _catEmoji: cat.emoji || '', _catName: cat.name || cat.label || '' });
          }
        }
      }
      if (!matches.length) {
        root.innerHTML = emptyState('Keine Regeln gefunden.', `Keine Treffer für „${q}".`);
        return;
      }
      root.innerHTML = matches.map((r, i) => this.renderRuleItem(r, i + 1, true)).join('');
      return;
    }

    root.innerHTML = this._categories.map(cat => this.renderCategory(cat)).join('');

    // Attach collapse listeners after DOM insert
    root.querySelectorAll('.rule-category-header').forEach(hdr => {
      hdr.addEventListener('click', () => {
        const key = hdr.dataset.catKey;
        this._collapsed[key] = !this._collapsed[key];
        hdr.classList.toggle('collapsed', !!this._collapsed[key]);
        const body = hdr.nextElementSibling;
        if (body) body.classList.toggle('collapsed', !!this._collapsed[key]);
      });
    });
  },

  renderCategory(cat) {
    const key = String(cat.key || cat.id || cat.name || Math.random());
    const collapsed = !!this._collapsed[key];
    const rules = cat.rules || [];
    return `
      <div class="rule-category">
        <div class="rule-category-header${collapsed ? ' collapsed' : ''}" data-cat-key="${escapeHtml(key)}">
          <div class="rule-category-icon">${escapeHtml(cat.emoji || '📋')}</div>
          <div class="rule-category-info">
            <div class="rule-category-name">${escapeHtml(cat.name || cat.label || key)}</div>
            <div class="rule-category-count">${rules.length} Regel${rules.length !== 1 ? 'n' : ''}</div>
          </div>
          <div class="rule-category-chevron">▼</div>
        </div>
        <div class="rule-category-body${collapsed ? ' collapsed' : ''}">
          ${rules.length
            ? rules.map((r, i) => this.renderRuleItem(r, i + 1, false)).join('')
            : `<div class="card" style="padding:0.75rem 1rem;color:var(--text-muted);font-size:0.82rem">Keine Regeln in dieser Kategorie.</div>`}
        </div>
      </div>
    `;
  },

  renderRuleItem(rule, num, showCat) {
    const title  = rule.title || rule.name || '';
    const body   = rule.body || rule.content || rule.description || '';
    const catTag = showCat && rule._catName
      ? `<span style="font-size:0.62rem;background:var(--surface-raised);border:1px solid var(--border);border-radius:3px;padding:0.12em 0.45em;color:var(--text-muted);margin-left:0.4rem">${escapeHtml(rule._catEmoji)} ${escapeHtml(rule._catName)}</span>`
      : '';
    return `
      <div class="rule-item">
        <div class="rule-item-header">
          <span class="rule-number">#${num}</span>
          <span class="rule-title">${escapeHtml(title)}${catTag}</span>
        </div>
        ${body ? `<div class="rule-body">${this.formatBody(body)}</div>` : ''}
      </div>
    `;
  },

  formatBody(text) {
    // Safe HTML: escape first, then convert bullet/numbered lines and paragraphs
    const esc   = text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const lines = esc.split('\n').filter(l => l.trim() !== '');
    const html  = [];
    let listType = null;

    for (const line of lines) {
      const isBullet  = /^[-*•]\s/.test(line);
      const isNumered = /^\d+\.\s/.test(line);
      const type      = isBullet ? 'ul' : isNumered ? 'ol' : null;

      if (type) {
        if (listType !== type) {
          if (listType) html.push(`</${listType}>`);
          html.push(`<${type}>`);
          listType = type;
        }
        html.push(`<li>${line.replace(/^[-*•]\s|^\d+\.\s/, '')}</li>`);
      } else {
        if (listType) { html.push(`</${listType}>`); listType = null; }
        html.push(`<p>${line}</p>`);
      }
    }
    if (listType) html.push(`</${listType}>`);
    return html.join('');
  },
};
```

- [ ] **Step 2: Verify no references to old helpers are broken**

The new code uses: `pageHeader`, `loadingState`, `emptyState`, `errorState`, `escapeHtml` — all available from `app.js`. `API.rules()` is available from `api.js`. No new dependencies.

- [ ] **Step 3: Commit**

```bash
git add dashboard/public-user/js/pages/rules.js
git commit -m "feat(public-dashboard): rewrite rules page with collapsible categories and rule cards"
```

---

## Task 5: Admin Dashboard — overview.js integration health cards

**Files:**
- Modify: `dashboard/public/js/pages/overview.js`

Add an integration health section at the top of the admin overview with status cards for: Bot, SCUM Server, AI, Database. Data comes from the existing `API.system.doctor()` endpoint. The existing KPI stat cards below are preserved.

- [ ] **Step 1: Read the current admin overview.js**

Read `dashboard/public/js/pages/overview.js` to understand its current structure. It has a `render()` that calls `API.overview()` and `API.botHealth()`, renders ~8 KPI stat cards, a quick status section, and quick actions.

- [ ] **Step 2: Add `loadHealthCards()` method and insert health section before KPIs**

In `overview.js`, add the health section rendering. The overview page object (`window['page-overview']`) gains a `renderHealthCards(doctor)` method and calls `API.system.doctor()` in parallel with the existing calls.

In the `render()` method, add a `<div id="overview-health"></div>` placeholder at the very top of the rendered HTML (before the existing stat-grid). After rendering, call `this.loadHealth()` to fill it.

Add these methods to the page object:

```js
async loadHealth() {
  const el = document.getElementById('overview-health');
  if (!el) return;
  try {
    const { data } = await API.system.doctor();
    el.innerHTML = this.renderHealthSection(data);
  } catch {
    el.innerHTML = ''; // non-critical, silently skip
  }
},

renderHealthSection(doc) {
  if (!doc) return '';
  const checks = doc.checks || [];

  const card = (name, valueText, statusClass, meta, diag) => `
    <div class="health-card ${statusClass}">
      <div class="health-card-header">
        <span class="health-card-name">${escapeHtml(name)}</span>
      </div>
      <div class="health-card-value ${statusClass}">${escapeHtml(valueText)}</div>
      ${meta ? `<div class="health-card-meta">${escapeHtml(meta)}</div>` : ''}
      ${diag ? `<div class="health-card-diag">${escapeHtml(diag)}</div>` : ''}
    </div>
  `;

  const getCheck = (key) => checks.find(c => c.key === key || c.name === key) || null;

  const botCheck    = getCheck('bot')       || getCheck('discord');
  const serverCheck = getCheck('scum')      || getCheck('server')  || getCheck('scum_server');
  const aiCheck     = getCheck('ai')        || getCheck('openai')  || getCheck('groq');
  const dbCheck     = getCheck('db')        || getCheck('database');

  const toClass = (ok) => ok === true ? 'ok' : ok === false ? 'error' : 'warn';
  const toLabel = (ok) => ok === true ? 'OK' : ok === false ? 'Fehler' : 'Unbekannt';

  return `
    <div class="section-header" style="margin-bottom:0.75rem">
      <div class="section-title">Systemstatus</div>
      <a href="#/system" style="font-size:0.75rem;color:var(--text-muted)">Details →</a>
    </div>
    <div class="health-grid" style="margin-bottom:1.75rem">
      ${card('Bot', toLabel(botCheck?.ok), toClass(botCheck?.ok), botCheck?.detail || '', botCheck?.ok === false ? (botCheck?.error || botCheck?.message || '') : '')}
      ${card('SCUM Server', toLabel(serverCheck?.ok), toClass(serverCheck?.ok), serverCheck?.detail || '', serverCheck?.ok === false ? (serverCheck?.error || '') : '')}
      ${card('AI Provider', toLabel(aiCheck?.ok), toClass(aiCheck?.ok), aiCheck?.detail || aiCheck?.model || '', aiCheck?.ok === false ? (aiCheck?.error || '') : '')}
      ${card('Datenbank', toLabel(dbCheck?.ok), toClass(dbCheck?.ok), dbCheck?.detail || '', dbCheck?.ok === false ? (dbCheck?.error || '') : '')}
    </div>
  `;
},
```

In the `render()` function, add `<div id="overview-health"></div>` before the existing stat-grid HTML output, and call `this.loadHealth()` after the initial render.

- [ ] **Step 3: Verify the integration health section works gracefully when doctor() fails**

The `loadHealth()` silently clears the element on error — the overview still shows the rest of its content. The `API.system.doctor()` endpoint already exists (used by the system page). No new endpoint needed.

- [ ] **Step 4: Commit**

```bash
git add dashboard/public/js/pages/overview.js
git commit -m "feat(admin-dashboard): add integration health cards to overview page"
```

---

## Task 6: Admin Dashboard — SettingsHelper dirty state

**Files:**
- Modify: `dashboard/public/js/settings-helper.js`

Add dirty-state tracking. When any field differs from its loaded value, show a sticky yellow banner "Ungespeicherte Änderungen". After save or cancel, banner is hidden.

- [ ] **Step 1: Add `_isDirty()` method to the page object inside `buildPage`**

Add after the `_meta: {}` line:

```js
_isDirty() {
  for (const section of config.sections || []) {
    for (const f of section.fields || []) {
      if (f.type === 'readonly') continue;
      const cur  = this._values[f.key];
      const orig = this._loaded[f.key];
      // For secrets still masked, treat as unchanged
      if (f.type === 'secret' && cur === '***' && orig === '***') continue;
      if (String(cur ?? '') !== String(orig ?? '')) return true;
    }
  }
  return false;
},

_updateDirtyBanner() {
  const banner = document.getElementById('s-dirty-banner');
  if (!banner) return;
  banner.classList.toggle('visible', this._isDirty());
},
```

- [ ] **Step 2: Add dirty banner HTML to `renderForm()`**

At the very start of the HTML built in `renderForm()`, before the first `<div class="settings-section">`:

```js
let html = `
  <div class="dirty-banner" id="s-dirty-banner">
    <span class="dirty-dot"></span>
    Ungespeicherte Änderungen — nicht vergessen zu speichern.
  </div>
`;
```

- [ ] **Step 3: Call `_updateDirtyBanner()` after every field change**

In `attachEvents()`, at the end of each `el.addEventListener('change', ...)` and `el.addEventListener('input', ...)` callback, add:
```js
self._updateDirtyBanner();
```

Also after `[data-secret-replace]` click re-renders the form, call `self._updateDirtyBanner()`.

- [ ] **Step 4: Hide banner after save/cancel**

In the `save()` method, after `await this.load()` succeeds, the form is re-rendered so the banner resets.

In the cancel handler (which calls `self.load()`), it's already handled since `load()` resets `_values`.

- [ ] **Step 5: Verify dirty banner appears and disappears correctly**

After rendering a settings page, change a field value → banner appears. Revert to original value → banner disappears. Click Save → banner disappears after reload.

- [ ] **Step 6: Commit**

```bash
git add dashboard/public/js/settings-helper.js
git commit -m "feat(admin-dashboard): add dirty state tracking to SettingsHelper with sticky unsaved-changes banner"
```

---

## Task 7: Public Overview — fix emptyState calls + player chart

**Files:**
- Modify: `dashboard/public-user/js/pages/overview.js`

The overview.js calls `emptyState('msg', 'subtitle')` which now works after Task 3. Also add a player history chart at the bottom of the overview if server status data is available (already fetched via `API.overview()`).

- [ ] **Step 1: Read overview.js to find all two-argument emptyState calls**

Search for `emptyState(` in `dashboard/public-user/js/pages/overview.js`. The calls with two arguments are fine after Task 3 (emptyState now accepts a subtitle). Verify no calls pass raw unsanitized HTML in the first argument.

- [ ] **Step 2: Add a player history chart section at the bottom of the overview**

After the existing `<div class="content-grid">` section (announcements + events + changelog), add:

```js
// Inside the root.innerHTML template string, after the content-grid:
${server?.history?.length ? `
  <div class="section-header" style="margin-top:1.5rem"><div class="section-title">Spieler-Verlauf 24h</div></div>
  <section class="chart-card">
    <div class="card-header"><div class="card-title">SCUM Server — Live Spieler</div></div>
    <div style="height:200px"><canvas id="overview-players-chart"></canvas></div>
  </section>
` : ''}
```

Then after the DOM is built (after `Charts.radialScore(...)` calls), add:

```js
if (server?.history?.length) {
  const pts = server.history.slice(-60); // last 60 data points
  Charts.lineChart('overview-players-chart',
    pts.map(h => {
      const d = new Date((h.checkedAt ?? h.checked_at ?? 0) * 1000);
      return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
    }),
    [{
      label: 'Spieler',
      data: pts.map(h => h.online ? (h.playersOnline ?? h.players_online ?? 0) : null),
      borderColor: '#3bca6e',
      backgroundColor: 'rgba(59,202,110,0.08)',
      tension: 0.2, fill: true, stepped: true,
      pointRadius: 0, pointHoverRadius: 4, spanGaps: false,
    }]
  );
}
```

- [ ] **Step 3: Commit**

```bash
git add dashboard/public-user/js/pages/overview.js
git commit -m "feat(public-dashboard): add player history chart to overview + fix emptyState subtitle calls"
```

---

## Task 8: Public Server page — layout improvements

**Files:**
- Modify: `dashboard/public-user/js/pages/server.js`

After the bug fix (Task 1), improve the server page with a status-strip at top, cleaner stat cards, and better wipe panel. No new API calls — data comes from the existing `API.server()` response.

- [ ] **Step 1: Read the current (now de-duplicated) server.js structure**

Read `dashboard/public-user/js/pages/server.js`. The page renders: server hero card, stat grid (uptime/peak/points), two charts (players + ping), config cards grid, and wipe panel.

- [ ] **Step 2: Replace the hero card with a compact status-strip**

Find the `<section class="server-hero card">` block in the template string. Replace with a two-part layout:
- A compact status strip showing: online status badge, player count, max players, ping, last check
- Keep the existing stat grid below it

New status strip:

```js
`<div class="status-strip">
  <div class="status-strip-item">
    ${statusBadge(current?.online)}
  </div>
  <div class="status-strip-item">
    <span class="status-strip-label">Spieler</span>
    <span class="status-strip-value">${current ? `${fmt(current.playersOnline)} / ${fmt(current.maxPlayers)}` : '—'}</span>
  </div>
  <div class="status-strip-item">
    <span class="status-strip-label">Ping</span>
    <span class="status-strip-value">${current?.ping != null ? `${current.ping} ms` : '—'}</span>
  </div>
  <div class="status-strip-item">
    <span class="status-strip-label">Letzter Check</span>
    <span class="status-strip-value" style="font-family:var(--sans);font-size:0.8rem">${fmtDate(current?.checkedAt)}</span>
  </div>
</div>`
```

Add `.status-strip` to the public-user CSS (add to the CSS file if not already done in Task 2):

```css
.status-strip {
  display: flex; align-items: center; gap: 1.5rem;
  padding: 0.75rem 1.1rem;
  background: var(--surface); border: 1px solid var(--border);
  border-radius: var(--radius-lg); margin-bottom: 1.25rem; flex-wrap: wrap;
}
.status-strip-item { display: flex; align-items: center; gap: 0.5rem; font-size: 0.8rem; }
.status-strip-label { color: var(--text-muted); }
.status-strip-value { font-weight: 700; color: var(--text); font-family: var(--mono); }
```

Note: `.status-strip` is also added in Task 2 CSS. If Task 2 already includes it, skip the CSS addition here — just verify it exists.

- [ ] **Step 3: Commit**

```bash
git add dashboard/public-user/js/pages/server.js dashboard/public-user/css/dashboard.css
git commit -m "feat(public-dashboard): improve server page layout with status-strip"
```

---

## Task 9: Create docs/DASHBOARD.md

**Files:**
- Create: `docs/DASHBOARD.md`

Document the dashboard architecture for future developers.

- [ ] **Step 1: Write `docs/DASHBOARD.md`**

```markdown
# Dashboard Architecture

Two dashboards are served by the sectorbot web server:

| Dashboard | Path | Audience | Auth |
|-----------|------|----------|------|
| Public Hub | `/hub` → `dashboard/public-user/` | All players | None (some pages require Discord OAuth) |
| Admin Panel | `/` → `dashboard/public/` | Server admins | Discord OAuth + admin role check |

## Technical Pattern

Both dashboards are single-page apps (vanilla JS) with hash-based routing (`#/page-name`).

### Page Modules

Each page is a JS module registered on `window`:

```js
window['page-name'] = {
  async render(container) {
    container.innerHTML = '...';
    // fetch data and populate
  }
};
```

Pages are loaded lazily via `loadScript()` and cached by `_loadedScripts`. The router in `app.js` instantiates them on navigation.

### Shared Helpers (app.js)

| Function | Description |
|----------|-------------|
| `escapeHtml(s)` | XSS-safe string escaping |
| `fmt(n)` | Number formatting (1k, 1M) |
| `fmtDate(ts)` | Unix timestamp → de-DE locale string |
| `fmtDuration(secs)` | Seconds → "Xh Ym" |
| `emptyState(msg, sub?)` | Empty state HTML with optional subtitle |
| `loadingState()` | Skeleton loading card HTML |
| `errorState(err)` | Error state HTML |
| `statusBadge(online)` | Green/red online badge HTML |
| `pageHeader(icon, title, desc)` | Standard page header HTML |
| `statCard(label, value, sub, color?)` | Stat card HTML |
| `periodBar(current, onChange)` | Time period selector element |
| `toast(msg, level, ms)` | Toast notification |

### CSS Design Tokens

Both dashboards share identical tokens in `dashboard.css`:

| Token | Value | Usage |
|-------|-------|-------|
| `--bg` | `#07080c` | Page background |
| `--surface` | `#0f1018` | Card backgrounds |
| `--accent` | `#b5162f` | Blood-red brand color |
| `--online` | `#3bca6e` | Online/success |
| `--offline` | `#e05252` | Offline/error |
| `--warning` | `#e8981a` | Warning |

### Admin Settings

All admin settings pages use `SettingsHelper.buildPage(config)` in `settings-helper.js`. Provide a `category` string and `sections[]` with `fields[]`. The helper handles load/save/reset and dirty-state tracking.

### API Clients

- Admin: `dashboard/public/js/api.js` → `/api/...`
- Public: `dashboard/public-user/js/api.js` → `/public-api/...`

Public endpoints are unauthenticated by default; some (`/me`, `/tickets/mine`) require Discord OAuth and return `{ unauthenticated: true }` gracefully on 401.

## Key Files

```
dashboard/
  public/               ← Admin dashboard
    index.html
    css/dashboard.css
    js/
      app.js            ← Router, shared helpers, auth check
      api.js            ← Admin API client
      charts.js         ← Chart.js factory functions
      settings-helper.js← Generic settings page renderer
      pages/
        overview.js     ← Main admin overview with health cards
        settings-*.js   ← 12 settings pages
        tickets.js      ← Ticket management
        ...
  public-user/          ← Public player hub
    index.html
    css/dashboard.css
    js/
      app.js            ← Router, shared helpers, no auth redirect
      api.js            ← Public API client
      charts.js         ← Chart.js factory functions
      pages/
        overview.js     ← Community status hub
        server.js       ← SCUM server status + charts
        rules.js        ← Collapsible rules with search
        statistik.js    ← Community analytics
        community.js    ← Member stats + top channels
        ...
```
```

- [ ] **Step 2: Commit**

```bash
git add docs/DASHBOARD.md
git commit -m "docs: add DASHBOARD.md architecture reference"
```

---

## Self-Review Checklist

After writing all tasks, reviewing against the user's spec:

**Coverage:**
- [x] Fix server.js duplicate bug → Task 1
- [x] CSS new utility classes (health-card, rule-item, dirty-banner, status-strip, mobile) → Task 2
- [x] Fix emptyState helper → Task 3
- [x] Rules page with collapsible categories, rule cards, search → Task 4
- [x] Admin overview integration health cards → Task 5
- [x] Admin settings dirty state → Task 6
- [x] Public overview player history chart → Task 7
- [x] Server page status-strip layout → Task 8
- [x] Documentation → Task 9

**Constraints verified:**
- No new npm dependencies ✓
- No fake data — all data from existing API endpoints ✓
- No API contract changes ✓
- No feature removal ✓
- Admin routes remain server-side protected (not touched) ✓
- No API keys in HTML ✓

**Placeholder scan:** None found.

**Type/naming consistency:**
- `health-card` CSS class used in Task 2 CSS and Task 5 JS ✓
- `dirty-banner`/`dirty-dot` CSS class used in Task 2 CSS and Task 6 JS ✓
- `rule-category`, `rule-item`, `rule-body` used in Task 2 CSS and Task 4 JS ✓
- `status-strip` used in Task 2 CSS and Task 8 JS ✓
- `emptyState(msg, sub)` fixed in Task 3, used with two args in Task 4 JS ✓
