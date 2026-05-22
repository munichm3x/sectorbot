// dashboard/public-user/js/api.js
// Public dashboard API client. Public endpoints never force a login redirect.

const API = {
  _timeoutMs: 15000,

  _parseResponseBody: async (res) => {
    const text = await res.text();
    if (!text) return {};
    try {
      return JSON.parse(text);
    } catch {
      return {};
    }
  },

  async _fetch(url, options = {}) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), API._timeoutMs);
    let res;
    try {
      res = await fetch(url, { credentials: 'same-origin', signal: controller.signal, ...options });
    } catch (err) {
      if (err?.name === 'AbortError') {
        const timeoutError = new Error('Zeitüberschreitung bei der Anfrage. Bitte erneut versuchen.');
        timeoutError.status = 408;
        throw timeoutError;
      }
      throw err;
    } finally {
      clearTimeout(timeout);
    }
    const body = await API._parseResponseBody(res);
    if (!res.ok) {
      const err = new Error(body.error ?? `HTTP ${res.status}`);
      err.status = res.status;
       err.payload = body;
      throw err;
    }
    return body;
  },

  async getPublic(path) {
    return this._fetch('/public-api' + path);
  },

  async getPrivate(path) {
    try {
      return await this._fetch('/public-api' + path);
    } catch (err) {
      if (err.status === 401) return { success: false, unauthenticated: true, data: null };
      throw err;
    }
  },

  me:              () => API.getPrivate('/me'),
  overview:        () => API.getPublic('/overview'),
  server:          () => API.getPublic('/server'),
  community:       () => API.getPublic('/community'),
  rules:           () => API.getPublic('/rules'),
  events:          () => API.getPublic('/events'),
  changelog:       () => API.getPublic('/changelog'),
  announcements:   () => API.getPublic('/announcements'),
  faq:             () => API.getPublic('/faq'),
  support:         () => API.getPublic('/support'),
  whitelistStatus: () => API.getPrivate('/me/whitelist-status'),

  messages:      (p) => API.getPublic(`/analytics/messages?period=${p}`),
  voice:         (p) => API.getPublic(`/analytics/voice?period=${p}`),
  growth:        (p) => API.getPublic(`/analytics/growth?period=${p}`),
  tickets:       (p) => API.getPublic(`/analytics/tickets?period=${p}`),
  statusHistory: (p) => API.getPublic(`/analytics/server-status?period=${p}`),
  heatmap:       (p) => API.getPublic(`/analytics/heatmap?period=${p}`),
  engagement:    (p) => API.getPublic(`/analytics/engagement?period=${p}`),

  myTickets: (q) => API.getPrivate(`/tickets/mine?${new URLSearchParams(q)}`),
  myTicket:  (id) => API.getPrivate(`/tickets/mine/${id}`),
};

window.API = API;
