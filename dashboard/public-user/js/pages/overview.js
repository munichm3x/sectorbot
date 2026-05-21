// dashboard/public-user/js/pages/overview.js
window['page-overview'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Community Übersicht</h1>
        <p>SECTOR 13 Server- und Community-Status auf einen Blick.</p>
      </div>
      <div id="overview-content"><div class="skeleton tall"></div></div>
    `;
    try {
      const { data } = await API.overview();
      const { scumServer, guild, activity } = data;

      const serverOnline = scumServer?.online;

      document.getElementById('overview-content').innerHTML = `
        <div class="stat-grid">
          <div class="stat-card ${serverOnline ? 'online' : 'offline'}">
            <div class="stat-label">SCUM Server</div>
            <div class="stat-value ${serverOnline ? 'online' : 'offline'}">${serverOnline ? '● Online' : '○ Offline'}</div>
            <div class="stat-sub">${serverOnline ? escapeHtml(String(scumServer.playersOnline)) + '/' + escapeHtml(String(scumServer.maxPlayers)) + ' Spieler' : 'Kein Status'}</div>
          </div>
          <div class="stat-card accent">
            <div class="stat-label">Ping</div>
            <div class="stat-value mono">${scumServer ? escapeHtml(String(scumServer.ping ?? '—')) : '—'}<small style="font-size:0.85rem;font-weight:400">ms</small></div>
            <div class="stat-sub">Server Latenz</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Discord Mitglieder</div>
            <div class="stat-value">${guild ? escapeHtml(fmt(guild.memberCount)) : '—'}</div>
            <div class="stat-sub">${guild ? escapeHtml(guild.name) : ''}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Nachrichten 24h</div>
            <div class="stat-value">${escapeHtml(fmt(activity.messages))}</div>
            <div class="stat-sub">Discord-Aktivität</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Voice 24h</div>
            <div class="stat-value">${escapeHtml(fmt(Math.round((activity.voiceSecs ?? 0) / 60)))}</div>
            <div class="stat-sub">Minuten kumuliert</div>
          </div>
        </div>
        ${scumServer ? `
          <div class="section-header" style="margin-top:1.5rem"><div class="section-title">Server Details</div></div>
          <div class="card">
            <div class="card-header">
              <div class="card-title">SCUM Server Status</div>
              <span class="badge ${serverOnline ? 'badge-online' : 'badge-offline'}">${serverOnline ? 'Online' : 'Offline'}</span>
            </div>
            ${serverOnline ? `
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:1rem">
                <div><div class="stat-label">Spieler</div><div style="font-size:1.4rem;font-weight:700;font-family:var(--mono)">${escapeHtml(String(scumServer.playersOnline))}/<span style="color:var(--text-muted);font-size:1rem">${escapeHtml(String(scumServer.maxPlayers))}</span></div></div>
                <div><div class="stat-label">Ping</div><div style="font-size:1.4rem;font-weight:700;font-family:var(--mono)">${escapeHtml(String(scumServer.ping ?? '—'))}<small style="font-size:0.8rem;color:var(--text-muted)">ms</small></div></div>
                <div><div class="stat-label">Letzter Check</div><div style="font-size:0.82rem;color:var(--text-secondary);margin-top:0.3rem">${fmtDate(scumServer.lastCheck)}</div></div>
              </div>
            ` : `<p style="color:var(--text-muted);font-size:0.85rem">Server ist offline oder nicht erreichbar.</p>`}
          </div>
        ` : ''}
      `;
    } catch (err) {
      document.getElementById('overview-content').innerHTML = errorState(err.message);
    }
  },
};
