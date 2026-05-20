// dashboard/public/js/pages/overview.js
window['page-overview'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Overview</h1>
        <p>Echtzeit-Überblick über Bot, Server und Discord-Aktivität.</p>
      </div>
      <div id="ov-content"><div class="skeleton tall"></div></div>
    `;

    try {
      const { data } = await API.overview();
      const { bot, serverStatus, tickets, activity, guild } = data;

      document.getElementById('ov-content').innerHTML = `
        <!-- KPI Row 1 -->
        <div class="stat-grid">
          <div class="stat-card">
            <div class="stat-label">Bot Status</div>
            <div class="stat-value ${bot.status === 'online' ? 'online' : 'offline'}">${bot.status === 'online' ? '● Online' : '○ Offline'}</div>
            <div class="stat-sub">Uptime: ${fmtUptime(bot.uptimeSec)}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Latenz</div>
            <div class="stat-value mono">${bot.latencyMs ?? '—'}<small style="font-size:0.9rem">ms</small></div>
            <div class="stat-sub">WebSocket Ping</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Mitglieder</div>
            <div class="stat-value">${fmt(guild?.memberCount)}</div>
            <div class="stat-sub">+${fmt(activity.memberJoins)} heute</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">SCUM Server</div>
            <div class="stat-value ${serverStatus?.online ? 'online' : 'offline'}">${serverStatus?.online ? '● Online' : '○ Offline'}</div>
            <div class="stat-sub">${serverStatus?.online ? `${serverStatus.playersOnline}/${serverStatus.maxPlayers} Spieler` : 'Kein Status'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Offene Tickets</div>
            <div class="stat-value">${tickets.open}</div>
            <div class="stat-sub">${tickets.closedToday} heute gelöst</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Nachrichten 24h</div>
            <div class="stat-value">${fmt(activity.messages)}</div>
            <div class="stat-sub">Discord-Aktivität</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Voice 24h</div>
            <div class="stat-value">${Charts.fmtDuration(activity.voiceSecs)}</div>
            <div class="stat-sub">Kumuliert</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">AI Requests 24h</div>
            <div class="stat-value">${fmt(activity.aiRequests)}</div>
            <div class="stat-sub">Groq / Ollama</div>
          </div>
        </div>

        <!-- Quick cards -->
        <div class="grid-2">
          <div class="card">
            <div class="card-header"><div class="card-title">Serverstatus</div></div>
            ${serverStatus ? `
              <p><span class="badge ${serverStatus.online ? 'badge-online' : 'badge-offline'}">${serverStatus.online ? 'Online' : 'Offline'}</span></p>
              ${serverStatus.online ? `
                <p style="margin-top:.75rem;color:var(--text-secondary);font-size:.85rem">
                  Spieler: <strong style="color:var(--text)">${serverStatus.playersOnline}/${serverStatus.maxPlayers}</strong> &nbsp;·&nbsp;
                  Ping: <strong style="color:var(--text)">${serverStatus.ping ?? '—'}ms</strong>
                </p>` : ''}
              <p style="margin-top:.5rem;font-size:.75rem;color:var(--text-muted)">Letzter Check: ${fmtDate(serverStatus.lastCheck)}</p>
            ` : '<p class="dim" style="font-size:.85rem">Noch kein Status — Server konfigurieren.</p>'}
          </div>
          <div class="card">
            <div class="card-header"><div class="card-title">Tickets</div></div>
            <div style="display:flex;gap:1.5rem">
              <div><div class="stat-label">Offen</div><div class="stat-value" style="font-size:1.4rem">${tickets.open}</div></div>
              <div><div class="stat-label">7 Tage</div><div class="stat-value" style="font-size:1.4rem">${tickets.closedWeek}</div></div>
            </div>
            <p style="margin-top:.75rem;font-size:.75rem;color:var(--text-muted)">→ <a href="#/tickets">Alle Tickets ansehen</a></p>
          </div>
        </div>
      `;
    } catch (err) {
      document.getElementById('ov-content').innerHTML = errorState(err.message);
    }
  },
};
