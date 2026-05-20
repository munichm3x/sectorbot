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
    if (!out) { this.stopStream(); return; }
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
    return `<div style="padding:.15rem 0;color:${colors[e.level]??'var(--text-secondary)'}"><span style="color:var(--text-muted)">${(e.ts ?? '').slice(11,19) || '--:--:--'}</span> <span style="font-weight:600">[${e.level.toUpperCase()}]</span> ${e.message.replace(/</g,'&lt;')}</div>`;
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
