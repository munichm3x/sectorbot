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