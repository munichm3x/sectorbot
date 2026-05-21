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
        <div class="filter-bar">
          <select class="filter-select" id="log-level-filter">
            <option value="">Alle Level</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
          <label style="display:flex;align-items:center;gap:.4rem;font-size:.82rem;color:var(--text-secondary)">
            <input type="checkbox" id="log-live-toggle" checked> Live-Stream
          </label>
        </div>
        <div class="log-wrap" id="log-output">
          <div class="skeleton" style="height:60px;margin:1rem"></div>
        </div>
      </div>
      <div id="log-tab-audit" style="display:none">
        <div class="table-card" id="audit-output"><div class="skeleton tall"></div></div>
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

  renderLogs(logs) {
    const el = document.getElementById('log-output');
    if (!el) return;
    if (!logs || logs.length === 0) { el.innerHTML = emptyState('Keine Log-Einträge vorhanden.'); return; }
    el.innerHTML = logs.map(l => `
      <div class="log-entry">
        <span class="log-ts">${escapeHtml(l.ts ?? l.timestamp ?? '—')}</span>
        <span class="log-level ${escapeHtml((l.level ?? 'info').toLowerCase())}">${escapeHtml((l.level ?? 'INFO').toUpperCase())}</span>
        <span class="log-src">${escapeHtml(l.source ?? '')}</span>
        <span class="log-msg">${escapeHtml(l.message ?? '')}</span>
      </div>
    `).join('');
    el.scrollTop = el.scrollHeight;
  },

  appendLogs(entries) {
    const out = document.getElementById('log-output');
    const filter = document.getElementById('log-level-filter')?.value ?? '';
    if (!out) { this.stopStream(); return; }
    const filtered = filter ? entries.filter(e => e.level === filter) : entries;
    filtered.forEach(l => {
      const div = document.createElement('div');
      div.innerHTML = `
        <div class="log-entry">
          <span class="log-ts">${escapeHtml(l.ts ?? l.timestamp ?? '—')}</span>
          <span class="log-level ${escapeHtml((l.level ?? 'info').toLowerCase())}">${escapeHtml((l.level ?? 'INFO').toUpperCase())}</span>
          <span class="log-src">${escapeHtml(l.source ?? '')}</span>
          <span class="log-msg">${escapeHtml(l.message ?? '')}</span>
        </div>
      `;
      out.appendChild(div.firstChild);
    });
    // Keep max 500 lines in DOM
    while (out.children.length > 500) out.removeChild(out.firstChild);
    out.scrollTop = out.scrollHeight;
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
              <td class="dim mono" style="font-size:.75rem">${escapeHtml(r.admin_user_id.slice(0,8))}…</td>
              <td class="mono" style="font-size:.78rem">${escapeHtml(r.action)}</td>
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
