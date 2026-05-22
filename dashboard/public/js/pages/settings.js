// dashboard/public/js/pages/settings.js
window['page-settings'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><h1>Einstellungen</h1><p>Bot- und System-Konfiguration. Secrets werden niemals angezeigt.</p></div>
      <div id="settings-content"><div class="skeleton tall"></div></div>
    `;

    try {
      const { data } = await API.settings();
      const { scumStatus } = data;

      document.getElementById('settings-content').innerHTML = `
        <!-- Server Status Settings -->
        <div class="section-header"><div class="section-title">Server Status</div></div>
        <div class="card" style="margin-bottom:1.5rem">
          <form id="form-scum">
            <div class="grid-2">
              <div class="form-group">
                <label class="form-label">Server Host / IP</label>
                <input class="form-input" name="host" value="${escapeHtml(scumStatus?.host ?? '')}">
              </div>
              <div class="form-group">
                <label class="form-label">Query Port</label>
                <input class="form-input" type="number" name="query_port" value="${scumStatus?.query_port ?? ''}">
              </div>
              <div class="form-group">
                <label class="form-label">Intervall (Sekunden)</label>
                <input class="form-input" type="number" name="update_interval_secs" value="${scumStatus?.update_interval_secs ?? 60}">
              </div>
              <div class="form-group">
                <label class="form-label">Aktiviert</label>
                <select class="filter-select" name="enabled">
                  <option value="1" ${scumStatus?.enabled ? 'selected' : ''}>Ja</option>
                  <option value="0" ${!scumStatus?.enabled ? 'selected' : ''}>Nein</option>
                </select>
              </div>
            </div>
            <button type="submit" class="btn btn-primary">Speichern</button>
            <span id="scum-msg" style="margin-left:.75rem;font-size:.8rem"></span>
          </form>
        </div>

        <!-- Info card -->
        <div class="section-header"><div class="section-title">Weitere Einstellungen</div></div>
        <div class="card" style="border-left:3px solid var(--accent-muted)">
          <p style="font-size:.82rem;color:var(--text-secondary);line-height:1.6">
            Weitere Einstellungen (Ticket-System, Streamer, AI, etc.) werden über die Discord-Slash-Commands
            <code style="font-family:var(--mono);font-size:.78rem;background:var(--surface-raised);padding:.1em .3em;border-radius:3px">/setup</code> und
            <code style="font-family:var(--mono);font-size:.78rem;background:var(--surface-raised);padding:.1em .3em;border-radius:3px">/config</code>
            konfiguriert. Secrets (API-Keys, Tokens) werden niemals im Dashboard angezeigt.
          </p>
        </div>
      `;

      document.getElementById('form-scum').addEventListener('submit', async (e) => {
        e.preventDefault();
        const fd   = new FormData(e.target);
        const body = { host: fd.get('host'), query_port: parseInt(fd.get('query_port')), update_interval_secs: parseInt(fd.get('update_interval_secs')), enabled: parseInt(fd.get('enabled')) };
        const msgEl = document.getElementById('scum-msg');
        try {
          await API.patch('/settings/scum', body);
          msgEl.textContent = '✓ Gespeichert';
          msgEl.style.color = 'var(--online)';
          toast('Einstellungen gespeichert.', 'success');
        } catch (err) {
          msgEl.textContent = '✕ Fehler: ' + err.message;
          msgEl.style.color = 'var(--offline)';
        }
        setTimeout(() => { msgEl.textContent = ''; }, 3000);
      });
    } catch (err) {
      document.getElementById('settings-content').innerHTML = errorState(err.message);
    }
  },
};
