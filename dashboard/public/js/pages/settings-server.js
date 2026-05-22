// dashboard/public/js/pages/settings-server.js
// SCUM server monitoring settings. Uses the existing /api/settings/scum endpoints from
// settings.routes.ts for SCUM-specific config, and generic bot_settings for extended values.
window['page-settings-server'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Server-Einstellungen</h1>
        <p>SCUM-Serverstatus-Monitoring konfigurieren. Server-Verbindung, Check-Intervall und Aktionen.</p>
      </div>
      <div id="srv-settings-content"><div class="skeleton" style="height:400px"></div></div>
    `;
    await this.load();
  },

  async load() {
    try {
      const { data } = await API.settings();
      this.renderForm(data?.scumStatus || {});
    } catch (err) {
      document.getElementById('srv-settings-content').innerHTML = errorState(err.message || 'Laden fehlgeschlagen');
    }
  },

  renderForm(s) {
    const el = document.getElementById('srv-settings-content');
    el.innerHTML = `
      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">SCUM Server-Verbindung</div>
            <div class="settings-section-desc">BattleMetrics-Query-Konfiguration</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Server-Host / IP</label>
              <input class="form-input" id="ss-host" value="${escapeHtml(s.host || '')}" maxlength="100" placeholder="z.B. 134.255.234.11" />
              <div class="form-help">Wird auf Public maskiert (nur letztes Oktett versteckt)</div>
            </div>
            <div class="form-group">
              <label class="form-label">Query-Port</label>
              <input class="form-input" id="ss-port" type="number" value="${s.query_port ?? ''}" min="1" max="65535" placeholder="z.B. 28902" />
              <div class="form-help">SCUM Query-Port (üblicherweise Spielport + 1)</div>
            </div>
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Update-Intervall (Sekunden)</label>
              <input class="form-input" id="ss-interval" type="number" value="${s.update_interval_secs ?? 60}" min="30" max="3600" />
              <div class="form-help">Wie oft der Bot den Server abfragt (mind. 30s)</div>
            </div>
            <div class="form-group">
              <label class="form-checkbox-row">
                <input type="checkbox" id="ss-enabled" ${s.enabled ? 'checked' : ''} />
                <span>Status-Monitoring aktiv</span>
              </label>
              <div class="form-help">Wenn aus, werden keine Status-Checks durchgeführt</div>
            </div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Status-Discord-Embed</div>
            <div class="settings-section-desc">Wo die Live-Statusnachricht im Discord erscheint</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div class="form-group">
            <label class="form-label">Status-Channel-ID</label>
            <input class="form-input" id="ss-channel" value="${escapeHtml(s.channel_id || '')}" maxlength="30" placeholder="Discord-Channel-ID" />
            <div class="form-help">Channel, in dem die Live-Statusnachricht aktualisiert wird</div>
          </div>
          <div class="form-group">
            <label class="form-label">Status-Message-ID (read-only)</label>
            <input class="form-input" value="${escapeHtml(s.message_id || '— noch nicht gesendet —')}" disabled />
            <div class="form-help">Wird automatisch gesetzt, wenn der Bot die Nachricht zum ersten Mal sendet</div>
          </div>
        </div>
      </div>

      <div class="settings-section">
        <div class="settings-section-header">
          <div>
            <div class="settings-section-title">Aktionen</div>
            <div class="settings-section-desc">Live-Tests und manuelle Status-Updates</div>
          </div>
        </div>
        <div class="settings-section-body">
          <div style="display:flex;gap:0.75rem;flex-wrap:wrap">
            <button class="btn btn-ghost" id="ss-test">▶ Status jetzt prüfen</button>
            <a class="btn btn-ghost" href="#/admin-server-info">→ Öffentliche Server-Info bearbeiten</a>
            <a class="btn btn-ghost" href="#/admin-wipe">→ Wipe-Info bearbeiten</a>
          </div>
          <div id="ss-test-result" style="margin-top:1rem"></div>
        </div>
      </div>

      <div class="settings-save-bar">
        <span class="audit-hint">Änderungen werden im Audit-Log protokolliert.</span>
        <button class="btn btn-ghost" id="ss-cancel">Zurücksetzen</button>
        <button class="btn btn-primary" id="ss-save">Speichern</button>
      </div>
    `;

    document.getElementById('ss-save').addEventListener('click', () => this.save());
    document.getElementById('ss-cancel').addEventListener('click', () => this.load());
    document.getElementById('ss-test').addEventListener('click', () => this.testStatus());
  },

  async save() {
    const body = {
      enabled: document.getElementById('ss-enabled').checked ? 1 : 0,
      host: document.getElementById('ss-host').value.trim() || null,
      query_port: Number(document.getElementById('ss-port').value) || null,
      update_interval_secs: Number(document.getElementById('ss-interval').value) || 60,
      channel_id: document.getElementById('ss-channel').value.trim() || null,
    };
    try {
      await API.patch('/settings/scum', body);
      toast('Server-Einstellungen gespeichert.', 'success');
      await this.load();
    } catch (err) {
      toast('Fehler: ' + (err.message || 'Speichern fehlgeschlagen'), 'error');
    }
  },

  async testStatus() {
    const btn = document.getElementById('ss-test');
    const resultEl = document.getElementById('ss-test-result');
    btn.disabled = true;
    btn.textContent = '⏳ Teste...';
    try {
      const { data } = await API.testStatus();
      if (data.online) {
        resultEl.innerHTML = `<div class="card"><span class="badge badge-online">Online</span> &nbsp; Spieler: <strong>${escapeHtml(String(data.players))}/${escapeHtml(String(data.maxPlayers))}</strong> &nbsp; Ping: <strong>${escapeHtml(String(data.ping ?? '—'))}ms</strong></div>`;
        toast('Server online!', 'success');
      } else {
        resultEl.innerHTML = `<div class="card"><span class="badge badge-offline">Offline</span> ${data.error ? `<span style="color:var(--text-muted);font-size:0.78rem">${escapeHtml(data.error)}</span>` : ''}</div>`;
        toast('Server nicht erreichbar.', 'error');
      }
    } catch (err) {
      resultEl.innerHTML = errorState(err.message || 'Test fehlgeschlagen');
    } finally {
      btn.disabled = false;
      btn.textContent = '▶ Status jetzt prüfen';
    }
  },
};
