// dashboard/public/js/pages/overview.js
window['page-overview'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Dashboard Overview</h1>
        <p>Echtzeit-Überblick über Bot, Server und Discord-Aktivität.</p>
      </div>
      <div id="ov-content"><div class="skeleton tall"></div></div>
    `;

    try {
      const { data } = await API.overview();
      const { bot, serverStatus, tickets, activity, guild } = data;

      document.getElementById('ov-content').innerHTML = `
        <!-- KPI Row -->
        <div class="stat-grid">
          <div class="stat-card ${bot.status === 'online' ? 'online' : 'offline'}">
            <div class="stat-label">Bot Status</div>
            <div class="stat-value ${bot.status === 'online' ? 'online' : 'offline'}">${bot.status === 'online' ? '● Online' : '○ Offline'}</div>
            <div class="stat-sub">Uptime: ${fmtUptime(bot.uptimeSec)}</div>
          </div>
          <div class="stat-card accent">
            <div class="stat-label">Latenz</div>
            <div class="stat-value mono">${escapeHtml(String(bot.latencyMs ?? '—'))}<small style="font-size:0.85rem;font-weight:400">ms</small></div>
            <div class="stat-sub">WebSocket Ping</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Mitglieder</div>
            <div class="stat-value">${fmt(guild?.memberCount)}</div>
            <div class="stat-sub">${activity.memberJoins > 0 ? `+${fmt(activity.memberJoins)} heute` : escapeHtml(String(guild?.memberCount ?? 0)) + ' gesamt'}</div>
          </div>
          <div class="stat-card ${serverStatus?.online ? 'online' : 'offline'}">
            <div class="stat-label">SCUM Server</div>
            <div class="stat-value ${serverStatus?.online ? 'online' : 'offline'}">${serverStatus?.online ? '● Online' : '○ Offline'}</div>
            <div class="stat-sub">${serverStatus?.online ? `${escapeHtml(String(serverStatus.playersOnline))}/${escapeHtml(String(serverStatus.maxPlayers))} Spieler` : 'Kein Status'}</div>
          </div>
          <div class="stat-card ${tickets.open > 0 ? 'warning' : ''}">
            <div class="stat-label">Offene Tickets</div>
            <div class="stat-value">${escapeHtml(String(tickets.open))}</div>
            <div class="stat-sub">${escapeHtml(String(tickets.closedToday))} heute gelöst</div>
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

        <!-- Quick Status -->
        <div class="section-header"><div class="section-title">Quick Status</div></div>
        <div class="grid-2">
          <div class="card">
            <div class="card-header">
              <div class="card-title">SCUM Serverstatus</div>
              <span class="badge ${serverStatus?.online ? 'badge-online' : 'badge-offline'}">${serverStatus?.online ? 'Online' : 'Offline'}</span>
            </div>
            ${serverStatus?.online ? `
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:1rem;margin-bottom:0.75rem">
                <div>
                  <div class="stat-label">Spieler</div>
                  <div style="font-size:1.4rem;font-weight:700;font-family:var(--mono)">${escapeHtml(String(serverStatus.playersOnline))}/<span style="color:var(--text-muted);font-size:1rem">${escapeHtml(String(serverStatus.maxPlayers))}</span></div>
                </div>
                <div>
                  <div class="stat-label">Ping</div>
                  <div style="font-size:1.4rem;font-weight:700;font-family:var(--mono)">${escapeHtml(String(serverStatus.ping ?? '—'))}<small style="font-size:0.8rem;color:var(--text-muted)">ms</small></div>
                </div>
              </div>
              <div style="font-size:0.75rem;color:var(--text-muted)">Letzter Check: ${fmtDate(serverStatus.lastCheck)}</div>
            ` : `<p style="color:var(--text-muted);font-size:0.85rem;margin-top:0.5rem">Kein Status — Server konfigurieren.</p>`}
          </div>
          <div class="card">
            <div class="card-header">
              <div class="card-title">Tickets</div>
              <a href="#/tickets" style="font-size:0.78rem;color:var(--accent)">Alle ansehen →</a>
            </div>
            <div style="display:flex;gap:2rem;margin-bottom:0.75rem">
              <div>
                <div class="stat-label">Offen</div>
                <div style="font-size:1.75rem;font-weight:700;font-family:var(--mono);color:${tickets.open > 0 ? 'var(--warning)' : 'var(--text)'}">${escapeHtml(String(tickets.open))}</div>
              </div>
              <div>
                <div class="stat-label">7-Tage gelöst</div>
                <div style="font-size:1.75rem;font-weight:700;font-family:var(--mono)">${escapeHtml(String(tickets.closedWeek))}</div>
              </div>
              <div>
                <div class="stat-label">Heute gelöst</div>
                <div style="font-size:1.75rem;font-weight:700;font-family:var(--mono)">${escapeHtml(String(tickets.closedToday))}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    } catch (err) {
      document.getElementById('ov-content').innerHTML = errorState(err.message);
    }
  },
};
