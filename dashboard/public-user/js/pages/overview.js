window['page-overview'] = {
  async render(container) {
    container.innerHTML = pageHeader('SECTOR 13', 'Community Statuszentrale', 'Serverstatus, Aktivität, Hinweise und Updates für Spieler.') + '<div id="overview-content"></div>';
    const root = document.getElementById('overview-content');

    try {
      const [{ data }, engagementRes, announcementsRes, eventsRes, changelogRes] = await Promise.all([
        API.overview(),
        API.engagement('7d').catch(() => ({ data: null })),
        API.announcements(),
        API.events(),
        API.changelog(),
      ]);

      const server = data.scumServer;
      const guild = data.guild;
      const activity = data.activity ?? {};
      const community = data.community ?? {};
      const engagement = engagementRes.data ?? null;
      const announcements = announcementsRes.data.announcements ?? [];
      const events = eventsRes.data.events ?? [];
      const changelog = changelogRes.data.changelog ?? [];

      root.innerHTML = `
        <section class="server-hero card">
          <div class="server-hero-main">
            <div class="kicker">SCUM Server</div>
            <h2>${guild ? escapeHtml(guild.name) : 'SECTOR 13'}</h2>
            <div class="server-status-line">${statusBadge(server?.online)}<span>Letzter Check: ${fmtDate(server?.checkedAt)}</span></div>
          </div>
          <div class="server-hero-stats">
            <div><span>Spieler</span><strong>${server ? `${fmt(server.playersOnline)}/${fmt(server.maxPlayers)}` : '-'}</strong></div>
            <div><span>Ping</span><strong>${server?.ping != null ? `${server.ping} ms` : '-'}</strong></div>
          </div>
          <div class="cta-row">
            <button class="btn btn-primary" onclick="navigateTo('server')">Serverstatus ansehen</button>
            <button class="btn btn-ghost" onclick="navigateTo('statistik')">Analytics öffnen</button>
            <button class="btn btn-ghost" onclick="navigateTo('rules')">Regeln lesen</button>
          </div>
        </section>

        ${engagement ? `
          <section class="analytics-public-strip">
            <div class="analytics-public-panel analytics-public-split">
              <div>
                <div class="kicker">Community Analytics</div>
                <h3>Engagement Score</h3>
                <p>Verdichteter Überblick aus Nachrichten, Voice-Zeit und Mitgliederwachstum der letzten 7 Tage.</p>
                <div class="cta-row">
                  <span class="badge badge-accent">Messages ${fmt(engagement.breakdown?.messages?.value ?? 0)}</span>
                  <span class="badge badge-online">Voice ${Charts.fmtDuration(engagement.breakdown?.voice?.value ?? 0)}</span>
                  <span class="badge badge-neutral">Joins ${fmt(engagement.breakdown?.joins?.value ?? 0)}</span>
                </div>
              </div>
              <div class="score-ring-wrap" style="width:150px;height:150px">
                <canvas id="public-overview-score"></canvas>
                <div class="score-ring-value">
                  <span class="score-number">${escapeHtml(String(engagement.score ?? 0))}</span>
                  <span class="score-label">/ 100</span>
                </div>
              </div>
            </div>
            <div class="analytics-public-panel">
              <div class="kicker">SCUM Auslastung</div>
              <h3>Live Player Gauge</h3>
              <p>Aktuelle Auslastung des Servers inklusive schneller Orientierung für Peak und Ping.</p>
              <div class="gauge-wrap">
                <canvas id="public-overview-gauge"></canvas>
                <div class="gauge-value">
                  <div class="gauge-number">${server ? `${fmt(server.playersOnline)}/${fmt(server.maxPlayers)}` : '—'}</div>
                  <div class="gauge-sub">Spieler online</div>
                </div>
              </div>
            </div>
          </section>
        ` : ''}

        <div class="stat-grid">
          ${statCard('Discord Mitglieder', guild ? fmt(guild.memberCount) : '-', guild?.name ?? 'Community')}
          ${statCard('Neue Mitglieder 7 Tage', fmt(community.newMembers7d ?? 0), 'Aggregiert')}
          ${statCard('Neue Mitglieder 30 Tage', fmt(community.newMembers30d ?? 0), 'Aggregiert')}
          ${statCard('Community Status', community.status ?? 'Ruhig', 'Aus aggregierter Aktivität', 'accent')}
        </div>

        <div class="section-header"><div class="section-title">Aktivität 24h</div></div>
        <div class="stat-grid">
          ${statCard('Nachrichten', fmt(activity.messages ?? 0), 'Heute insgesamt')}
          ${statCard('Voice-Zeit', fmtDuration(activity.voiceSecs ?? 0), 'Heute aggregiert')}
          ${statCard('Stream-Zeit', fmtDuration(activity.streamSecs ?? 0), 'Heute aggregiert')}
          ${statCard('Aktive Text-Channels', fmt(activity.activeTextChannels ?? 0), 'Heute aggregiert')}
        </div>

        <div class="content-grid">
          <section class="card">
            <div class="card-header"><div class="card-title">Aktuelle Hinweise</div></div>
            ${announcements.length ? announcements.map(renderAnnouncement).join('') : emptyState('Keine aktuellen Hinweise.', 'Wartung, Events oder wichtige Meldungen erscheinen hier.')}
          </section>
          <section class="card">
            <div class="card-header"><div class="card-title">Nächste Events</div><button class="btn btn-ghost" onclick="navigateTo('events')">Alle Events</button></div>
            ${events.length ? events.map(renderEvent).join('') : emptyState('Aktuell sind keine Events geplant.')}
          </section>
        </div>

        <section class="card timeline-card">
          <div class="card-header"><div class="card-title">Letzte Updates</div><button class="btn btn-ghost" onclick="navigateTo('changelog')">Changelog</button></div>
          ${changelog.length ? changelog.slice(0, 5).map(renderChangelog).join('') : emptyState('Noch keine öffentlichen Updates veröffentlicht.', 'Sobald Changelogs persistent gespeichert werden, erscheinen sie hier.')}
        </section>
      `;

      if (engagement) {
        Charts.radialScore('public-overview-score', engagement.score ?? 0);
      }
      if (server?.maxPlayers) {
        Charts.gauge('public-overview-gauge', server.playersOnline ?? 0, Math.max(server.maxPlayers ?? 0, 1), { color: '#3bca6e' });
      }
    } catch {
      root.innerHTML = errorState();
    }
  },
};

function renderAnnouncement(item) {
  return `<div class="notice-card"><span class="badge badge-accent">${escapeHtml(item.type ?? 'Hinweis')}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.message ?? '')}</p></div>`;
}

function renderEvent(item) {
  return `<div class="event-card"><span class="badge badge-neutral">${escapeHtml(item.status ?? 'geplant')}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.description ?? '')}</p></div>`;
}

function renderChangelog(item) {
  return `<div class="timeline-item"><span class="badge badge-accent">${escapeHtml(item.category ?? 'Update')}</span><strong>${escapeHtml(item.title)}</strong><small>${fmtDate(item.publishedAt)}</small></div>`;
}
