// dashboard/public-user/js/api.js
// Fetch wrappers for /public-api/* routes.
// On 401 → redirect to /public/login.html.

const API = {
  async _fetch(url, options = {}) {
    const res = await fetch(url, { credentials: 'same-origin', ...options });
    if (res.status === 401) {
      window.location.href = '/public/login.html';
      throw new Error('Unauthenticated');
    }
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new Error(body.error ?? `HTTP ${res.status}`);
    }
    return res.json();
  },

  async get(path) { return this._fetch('/public-api' + path); },

  // Convenience methods
  me:            () => API.get('/me'),
  overview:      () => API.get('/overview'),
  messages:      (p) => API.get(`/analytics/messages?period=${p}`),
  voice:         (p) => API.get(`/analytics/voice?period=${p}`),
  growth:        (p) => API.get(`/analytics/growth?period=${p}`),
  tickets:       (p) => API.get(`/analytics/tickets?period=${p}`),
  statusHistory: (p) => API.get(`/analytics/server-status?period=${p}`),
  ai:            (p) => API.get(`/analytics/ai?period=${p}`),
  myTickets:     (q) => API.get(`/tickets/mine?${new URLSearchParams(q)}`),
  myTicket:      (id) => API.get(`/tickets/mine/${id}`),
};

window.API = API;
