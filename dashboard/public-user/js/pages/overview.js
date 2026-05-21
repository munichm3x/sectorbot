window['page-overview'] = {
  async render(container) {
    container.innerHTML = pageHeader('SECTOR 13', 'Community Statuszentrale', 'Serverstatus, Aktivität, Hinweise und Updates für Spieler.') + '<div id="overview-content"></div>';
    const root = document.getElementById('overview-content');

    try {
      const [{ data }, announcementsRes, eventsRes, changelogRes] = await Promise.all([
        API.overview(),
        API.announcements(),
        API.events(),
        API.changelog(),
      ]);

      const server = data.scumServer;
      const guild = data.guild;
      const activity = data.activity ?? {};
      const community = data.community ?? {};
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
            <button class="btn btn-ghost" onclick="navigateTo('rules')">Regeln lesen</button>
          </div>
        </section>

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
