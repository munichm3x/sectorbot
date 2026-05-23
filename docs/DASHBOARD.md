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
| `emptyState(msg, detail?)` | Empty state HTML with optional subtitle |
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

All admin settings pages use `SettingsHelper.buildPage(config)` in `settings-helper.js`. Provide a `category` string and `sections[]` with `fields[]`. The helper handles load/save/reset and dirty-state tracking (shows a sticky banner when unsaved changes exist).

### API Clients

- Admin: `dashboard/public/js/api.js` → `/api/...`
- Public: `dashboard/public-user/js/api.js` → `/public-api/...`

Public endpoints are unauthenticated by default; some (`/me`, `/tickets/mine`) require Discord OAuth and return `{ unauthenticated: true }` gracefully on 401.

## Key Files

```
dashboard/
  public/                   ← Admin dashboard
    index.html
    css/dashboard.css
    js/
      app.js                ← Router, shared helpers, auth check
      api.js                ← Admin API client
      charts.js             ← Chart.js factory functions
      settings-helper.js    ← Generic settings page renderer with dirty state
      pages/
        overview.js         ← Main admin overview with integration health cards
        settings-*.js       ← 12 settings pages (use SettingsHelper.buildPage)
        tickets.js          ← Ticket management with structured JSON summary
        ...
  public-user/              ← Public player hub
    index.html
    css/dashboard.css
    js/
      app.js                ← Router, shared helpers, no auth redirect
      api.js                ← Public API client
      charts.js             ← Chart.js factory functions
      pages/
        overview.js         ← Community status hub with player history chart
        server.js           ← SCUM server status + charts (status-strip layout)
        rules.js            ← Collapsible rules with search and rule cards
        statistik.js        ← Community analytics
        community.js        ← Member stats + top channels
        ...
```

## Adding a New Page

1. Create `dashboard/public-user/js/pages/my-page.js` (or `dashboard/public/js/pages/my-page.js` for admin):
```js
window['page-my-page'] = {
  async render(container) {
    container.innerHTML = pageHeader('Icon', 'Title', 'Description') +
      '<div id="my-content">' + loadingState() + '</div>';
    // load data and render
  }
};
```
2. Add the page entry in `app.js` → `PAGE_TITLES` map
3. Add a nav item in `index.html`

## Adding a New Admin Settings Page

1. Create `dashboard/public/js/pages/settings-myfeature.js`:
```js
window['page-settings-myfeature'] = SettingsHelper.buildPage({
  category: 'myfeature',
  title: 'My Feature Settings',
  description: 'Description of what this configures.',
  sections: [
    {
      title: 'Section Title',
      desc: 'Section description',
      fields: [
        { key: 'my_key', label: 'My Label', type: 'text', help: 'Help text' },
      ],
    },
  ],
});
```
2. Add backend route to serve the settings category in `src/dashboard/routes/settings.ts`
3. Add nav item in admin `index.html` and entry in `PAGE_TITLES`
