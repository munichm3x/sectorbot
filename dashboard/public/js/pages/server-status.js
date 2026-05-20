// dashboard/public/js/pages/server-status.js
window['page-server-status'] = {
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Server Status</h1><p>Live-Statuscheck des SCUM-Servers.</p></div>
      <div id="ss-live"><div class="skeleton tall"></div></div>
    `;
    await self.load();
  },

  async load() {
    try {
      const { data: config } = await API.serverStatus();
      document.getElementById('ss-live').innerHTML = config ? `
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-label">Adresse</div><div class="stat-value mono" style="font-size:1rem">${config.host ?? '—'}</div><div class="stat-sub">Port: ${config.query_port ?? '—'}</div></div>
          <div class="stat-card"><div class="stat-label">Aktiv</div><div class="stat-value">${config.enabled ? '<span style="color:var(--online)">Ja</span>' : '<span style="color:var(--offline)">Nein</span>'}</div></div>
          <div class="stat-card"><div class="stat-label">Intervall</div><div class="stat-value mono" style="font-size:1rem">${config.update_interval_secs}s</div></div>
        </div>
        <div style="margin-top:1rem">
          <button class="btn btn-primary" id="test-btn">▶ Status jetzt testen</button>
        </div>
        <div id="test-result" style="margin-top:1rem"></div>
      ` : emptyState('Server noch nicht konfiguriert. Gehe zu Einstellungen → Server Status.');

      document.getElementById('test-btn')?.addEventListener('click', async () => {
        const btn = document.getElementById('test-btn');
        const resultEl = document.getElementById('test-result');
        btn.disabled = true; btn.textContent = '⏳ Teste...';
        try {
          const { data } = await API.testStatus();
          if (data.online) {
            resultEl.innerHTML = `<div class="card"><span class="badge badge-online">Online</span> &nbsp; Spieler: <strong>${data.players}/${data.maxPlayers}</strong> &nbsp; Ping: <strong>${data.ping ?? '—'}ms</strong></div>`;
            toast('Server online!', 'success');
          } else {
            resultEl.innerHTML = `<div class="card"><span class="badge badge-offline">Offline</span></div>`;
            toast('Server nicht erreichbar.', 'error');
          }
        } catch (err) {
          resultEl.innerHTML = errorState(err.message);
        } finally {
          btn.disabled = false; btn.textContent = '▶ Status jetzt testen';
        }
      });
    } catch (err) {
      document.getElementById('ss-live').innerHTML = errorState(err.message);
    }
  },
};
