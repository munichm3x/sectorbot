// dashboard/public-user/js/pages/overview.js
window['page-overview'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><h1>Übersicht</h1><p>SECTOR 13 Server- und Community-Status auf einen Blick.</p></div>
      <div id="overview-content">
        <div class="card"><div class="skeleton" style="height:120px"></div></div>
      </div>
    `;
    try {
      const { data } = await API.overview();
      const { scumServer, guild, activity } = data;

      const serverCard = scumServer ? `
        <div class="card">
          <div class="card-title">SCUM Server</div>
          <div class="stat-grid" style="margin-top:.75rem">
            <div class="stat-card">
              <div class="stat-label">Status</div>
              <div class="stat-value">
                <span class="status-badge ${scumServer.online ? 'online' : 'offline'}">
                  ${scumServer.online ? 'Online' : 'Offline'}
                </span>
              </div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Spieler</div>
              <div class="stat-value">${escapeHtml(String(scumServer.playersOnline ?? 0))} / ${escapeHtml(String(scumServer.maxPlayers ?? 64))}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Ping</div>
              <div class="stat-value">${escapeHtml(String(scumServer.ping ?? '—'))} ms</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Letzter Check</div>
              <div class="stat-value" style="font-size:.85rem">${fmtDate(scumServer.lastCheck)}</div>
            </div>
          </div>
        </div>
      ` : `<div class="card"><p style="color:var(--text-muted)">Keine Serverdaten verfügbar.</p></div>`;

      const guildCard = guild ? `
        <div class="card">
          <div class="card-title">Discord Server</div>
          <div class="stat-grid" style="margin-top:.75rem">
            <div class="stat-card">
              <div class="stat-label">Server</div>
              <div class="stat-value" style="font-size:1rem">${escapeHtml(guild.name)}</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Mitglieder</div>
              <div class="stat-value">${escapeHtml(fmt(guild.memberCount))}</div>
            </div>
          </div>
        </div>
      ` : '';

      const activityCard = `
        <div class="card">
          <div class="card-title">Aktivität (letzte 24h)</div>
          <div class="stat-grid" style="margin-top:.75rem">
            <div class="stat-card">
              <div class="stat-label">Nachrichten</div>
              <div class="stat-value">${escapeHtml(fmt(activity.messages))}</div>
              <div class="stat-sub">heute</div>
            </div>
            <div class="stat-card">
              <div class="stat-label">Voice Zeit</div>
              <div class="stat-value">${escapeHtml(fmt(Math.round((activity.voiceSecs ?? 0) / 60)))}</div>
              <div class="stat-sub">Minuten heute</div>
            </div>
          </div>
        </div>
      `;

      document.getElementById('overview-content').innerHTML = serverCard + guildCard + activityCard;
    } catch (err) {
      document.getElementById('overview-content').innerHTML = errorState(err.message);
    }
  },
};
