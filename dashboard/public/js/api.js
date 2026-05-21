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

  async put(path, body) {
    return this._fetch('/api' + path, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
  },

  async delete(path) {
    return this._fetch('/api' + path, { method: 'DELETE' });
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

  // === Admin Content CRUD ===
  adminRules: {
    list:    ()             => API.get('/rules'),
    get:     (id)           => API.get(`/rules/${id}`),
    create:  (body)         => API.post('/rules', body),
    update:  (id, body)     => API.patch(`/rules/${id}`, body),
    delete:  (id)           => API.delete(`/rules/${id}`),
    reorder: (body)         => API.post('/rules/reorder', body),
  },
  adminEvents: {
    list:    ()             => API.get('/events'),
    get:     (id)           => API.get(`/events/${id}`),
    create:  (body)         => API.post('/events', body),
    update:  (id, body)     => API.patch(`/events/${id}`, body),
    delete:  (id)           => API.delete(`/events/${id}`),
  },
  adminChangelog: {
    list:    ()             => API.get('/changelog'),
    get:     (id)           => API.get(`/changelog/${id}`),
    create:  (body)         => API.post('/changelog', body),
    update:  (id, body)     => API.patch(`/changelog/${id}`, body),
    delete:  (id)           => API.delete(`/changelog/${id}`),
    publish: (id, body)     => API.post(`/changelog/${id}/publish`, body),
  },
  adminAnnouncements: {
    list:    ()             => API.get('/announcements'),
    get:     (id)           => API.get(`/announcements/${id}`),
    create:  (body)         => API.post('/announcements', body),
    update:  (id, body)     => API.patch(`/announcements/${id}`, body),
    delete:  (id)           => API.delete(`/announcements/${id}`),
  },
  adminFaq: {
    list:    ()             => API.get('/faq'),
    get:     (id)           => API.get(`/faq/${id}`),
    create:  (body)         => API.post('/faq', body),
    update:  (id, body)     => API.patch(`/faq/${id}`, body),
    delete:  (id)           => API.delete(`/faq/${id}`),
    reorder: (body)         => API.post('/faq/reorder', body),
  },
  adminWipe: {
    get:    ()              => API.get('/wipe'),
    upsert: (body)          => API.put('/wipe', body),
  },
  adminServerInfo: {
    get:    ()              => API.get('/server-info'),
    upsert: (body)          => API.put('/server-info', body),
  },
  // === Settings ===
  botSettings: {
    list:    (cat)           => API.get(`/bot-settings/${cat}`),
    update:  (body)          => API.patch('/bot-settings', body),
    remove:  (cat, key)      => API.delete(`/bot-settings/${cat}/${encodeURIComponent(key)}`),
    test:    (cat, key, body)=> API.post(`/bot-settings/test/${cat}/${encodeURIComponent(key)}`, body ?? {}),
  },
  // === Preview + System ===
  publicPreview: () => API.get('/public-preview'),
  system: {
    get:           () => API.get('/system'),
    cacheClear:    () => API.post('/system/cache-clear', {}),
    resyncCommands:() => API.post('/system/resync-commands', {}),
  },
};

window.API = API;