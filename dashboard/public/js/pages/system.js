// dashboard/public/js/pages/system.js
window['page-system'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>System</h1>
        <p>Bot-Status, ENV-Konfiguration und gefährliche Aktionen.</p>
      </div>
      <div id="sys-content"><div class="skeleton" style="height:400px"></div></div>
    `;
    await this.load();
  },

  async load() {
    try {
      const { data } = await API.system.get();
      this.renderInfo(data);
    } catch (err) {
      document.getElementById('sys-content').innerHTML = errorState(err.message || 'Laden fehlgeschlagen');
    }
  },

  renderInfo(d) {
    const el = document.getElementById('sys-content');
    const bot = d.bot || {};
    const db = d.database || {};
    const env = d.env || {};
    const warnings = d.warnings || [];

    const fmtBytes = (b) => {
      if (b == null) return '—';
      if (b < 1024) return b + ' B';
      if (b < 1024*1024) return (b/1024).toFixed(1) + ' KB';
      return (b/1024/1024).toFixed(1) + ' MB';
    };
    const fmtUptime = (s) => {
      if (!s) return '—';
      const d = Math.floor(s / 86400);
      const h = Math.floor((s % 86400) / 3600);
      const m = Math.floor((s % 3600) / 60);
      if (d > 0) return `${d}d ${h}h`;
      if (h > 0) return `${h}h ${m}m`;
      return `${m}m`;
    };

    el.innerHTML = `
      <!-- Warnings -->
      ${warnings.length > 0 ? `
        <div class="settings-section" style="border-left:3px solid var(--warning)">
          <div class="settings-section-header">
            <div>
              <div class="settings-section-title" style="color:var(--warning)">⚠ Konfigurations-Warnungen</div>
              <div class="settings-section-desc">${warnings.length} Hinweis(e) gefunden</div>
            </div>
          </div>
          <div class="settings-section-body">
            <ul style="margin:0;padding-left:1.25rem;font-size:0.85rem;color:var(--text-secondary);line-height:1.7">
              ${warnings.map(w => `<li>${escapeHtml(w)}</li>`).join('')}
            </ul>
          </div>
        </div>
      ` : ''}

      <!-- Bot Info -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Bot-Status</div>
            <div class="settings-section-desc">Laufzeit-Informationen</div>
          </div>
          <span class="badge ${bot.online ? 'badge-online' : 'badge-offline'}">${bot.online ? 'Online' : 'Offline'}</span>
        </div>
        <div class="settings-section-body">
          <div class="stat-grid">
            <div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value">${escapeHtml(fmtUptime(bot.uptimeSec))}</div></div>
            <div class="stat-card"><div class="stat-label">Latenz</div><div class="stat-value mono">${escapeHtml(String(bot.latencyMs ?? '—'))}<small style="font-size:0.85rem">ms</small></div></div>
            <div class="stat-card"><div class="stat-label">RAM</div><div class="stat-value mono">${escapeHtml(String(bot.memoryMb ?? '—'))}<small style="font-size:0.85rem"> MB</small></div></div>
            <div class="stat-card"><div class="stat-label">Guilds</div><div class="stat-value">${escapeHtml(String(bot.guildCount ?? '—'))}</div></div>
            <div class="stat-card"><div class="stat-label">Node.js</div><div class="stat-value mono" style="font-size:1rem">${escapeHtml(bot.nodeVersion || '—')}</div></div>
            <div class="stat-card"><div class="stat-label">Bot User</div><div class="stat-value" style="font-size:0.95rem">${escapeHtml(bot.botUsername || '—')}</div><div class="stat-sub mono">${escapeHtml(bot.botUserId || '')}</div></div>
          </div>
        </div>
      </div>

      <!-- Database -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Datenbank</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Pfad</label>
              <input class="form-input mono" value="${escapeHtml(db.path || '—')}" disabled />
            </div>
            <div class="form-group">
              <label class="form-label">Größe</label>
              <input class="form-input mono" value="${escapeHtml(fmtBytes(db.sizeBytes))}" disabled />
            </div>
          </div>
        </div>
      </div>

      <!-- ENV Presence -->
      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">ENV-Konfiguration</div>
            <div class="settings-section-desc">Nur Schlüssel-Existenz — niemals Werte</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="table-wrap">
            <table>
              <thead><tr><th>Schlüssel</th><th>Status</th></tr></thead>
              <tbody>
                ${Object.entries(env).map(([key, present]) => `
                  <tr>
                    <td class="mono">${escapeHtml(key)}</td>
                    <td><span class="badge ${present ? 'badge-online' : 'badge-warning'}">${present ? '✓ gesetzt' : '○ fehlt'}</span></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      <!-- Danger Zone -->
      <div class="danger-zone">
        <div class="danger-zone-title">⚠ Gefährliche Aktionen</div>
        <div class="danger-zone-desc">
          Diese Aktionen können den Bot-Betrieb stören. Nur Owner kann sie ausführen. Alle Aktionen werden im Audit-Log protokolliert.
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap">
          <button class="btn btn-danger" id="sys-cache-clear">Discord-Cache leeren</button>
          <button class="btn btn-danger" id="sys-resync" disabled title="Nur über CLI (npm run deploy) verfügbar">Slash-Commands neu synchronisieren</button>
        </div>
      </div>
    `;

    document.getElementById('sys-cache-clear').addEventListener('click', () => this.cacheClear());
  },

  async cacheClear() {
    if (!confirm('Discord-Cache wirklich leeren? Members werden bei Bedarf neu geladen — kann Performance kurzzeitig beeinflussen.')) return;
    const btn = document.getElementById('sys-cache-clear');
    btn.disabled = true;
    btn.textContent = '⏳ Leere Cache...';
    try {
      await API.system.cacheClear();
      toast('Discord-Cache geleert.', 'success');
      await this.load();
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Aktion fehlgeschlagen'), 'error');
    } finally {
      btn.disabled = false;
      btn.textContent = 'Discord-Cache leeren';
    }
  },
};
