window['page-analytics-hub'] = {
  period: '7d',
  tab: 'overview',
  data: null,
  membersData: null,
  settingsData: null,

  async render(container) {
    container.innerHTML = `
      <div class="page-header">
        <h1>Analytics Hub</h1>
        <p>Professionelle Discord-, Bot- und SCUM-Server-Analysen mit Filtern, Trends und Export.</p>
      </div>
      <div class="analytics-toolbar">
        <div id="analytics-period-bar"></div>
        <div class="analytics-actions">
          <button class="btn btn-ghost" data-export="messages-by-day">CSV Nachrichten</button>
          <button class="btn btn-ghost" data-export="voice-by-day">CSV Voice</button>
          <button class="btn btn-ghost" data-export="members-by-day">CSV Mitglieder</button>
          <button class="btn btn-primary" data-export="server-status">JSON SCUM</button>
        </div>
      </div>
      <div id="analytics-hero">${loadingState()}</div>
      <div class="analytics-tabs" id="analytics-tabs">
        ${[
          ['overview', 'Overview'],
          ['members', 'Members'],
          ['activity', 'Activity'],
          ['voice', 'Voice'],
          ['streams', 'Streams'],
          ['teams', 'Teams/Roles'],
          ['channels', 'Channels'],
          ['tickets', 'Tickets'],
          ['bot', 'Bot Health'],
          ['scum', 'SCUM Server'],
          ['settings', 'Settings'],
        ].map(([key, label]) => `<button class="analytics-tab${this.tab === key ? ' active' : ''}" data-tab="${key}">${label}</button>`).join('')}
      </div>
      <div id="analytics-tab-content">${loadingState()}</div>
    `;

    const pb = periodBar(this.period, async (period) => {
      this.period = period;
      this.membersData = null;
      this.data = null;
      await this.loadAll();
    });
    document.getElementById('analytics-period-bar').replaceWith(pb);
    pb.id = 'analytics-period-bar';

    container.querySelectorAll('[data-export]').forEach((button) => {
      button.addEventListener('click', () => {
        const dataset = button.dataset.export;
        const format = dataset === 'server-status' ? 'json' : 'csv';
        window.open(API.exportUrl(dataset, format, this.period), '_blank', 'noopener');
      });
    });

    container.querySelectorAll('[data-tab]').forEach((button) => {
      button.addEventListener('click', async () => {
        this.tab = button.dataset.tab;
        container.querySelectorAll('[data-tab]').forEach((item) => item.classList.toggle('active', item.dataset.tab === this.tab));
        await this.renderTab();
      });
    });

    await this.loadAll();
  },

  async loadAll() {
    document.getElementById('analytics-hero').innerHTML = loadingState();
    document.getElementById('analytics-tab-content').innerHTML = loadingState();

    try {
      const [overviewRes, engagementRes, messagesRes, voiceRes, growthRes, ticketsRes, statusRes, heatmapRes, hourlyRes, botHealthRes, aiRes, commandsRes] = await Promise.all([
        API.overview(),
        API.engagement(this.period),
        API.messages(this.period),
        API.voice(this.period),
        API.growth(this.period),
        API.ticketStats(this.period),
        API.statusHistory(this.period),
        API.heatmap(this.period),
        API.hourly(this.period),
        API.botHealth(this.period),
        API.ai(this.period),
        API.commands(this.period),
      ]);

      this.data = {
        overview: overviewRes.data,
        engagement: engagementRes.data,
        messages: messagesRes.data,
        voice: voiceRes.data,
        growth: growthRes.data,
        tickets: ticketsRes.data,
        status: statusRes.data,
        heatmap: heatmapRes.data,
        hourly: hourlyRes.data,
        botHealth: botHealthRes.data,
        ai: aiRes.data,
        commands: commandsRes.data,
      };

      this.renderHero();
      await this.renderTab();
    } catch (err) {
      document.getElementById('analytics-hero').innerHTML = errorState(err.message || 'Analytics konnten nicht geladen werden.');
      document.getElementById('analytics-tab-content').innerHTML = errorState(err.message || 'Analytics konnten nicht geladen werden.');
    }
  },

  renderHero() {
    const hero = document.getElementById('analytics-hero');
    if (!hero || !this.data) return;
    const engagement = this.data.engagement || {};
    const overview = this.data.overview || {};
    const server = overview.serverStatus || {};
    const guild = overview.guild || {};
    const bot = this.data.botHealth || {};
    const interactions = bot.interactions || {};

    hero.innerHTML = `
      <div class="analytics-hero-grid">
        <section class="card analytics-hero-panel analytics-score-panel">
          <div>
            <div class="section-title">Community Engagement</div>
            <h2>Engagement Score</h2>
            <p class="analytics-copy">Aggregiert aus Nachrichten, Voice, Growth und Bot-Aktivität gegenüber der Vorperiode.</p>
            <div class="analytics-kpi-inline">
              ${renderTrendBadge(engagement.breakdown?.messages?.delta, 'Messages')}
              ${renderTrendBadge(engagement.breakdown?.voice?.delta, 'Voice')}
              ${renderTrendBadge(engagement.breakdown?.joins?.delta, 'Joins')}
            </div>
          </div>
          <div class="score-ring-wrap analytics-score-ring">
            <canvas id="analytics-engagement-ring"></canvas>
            <div class="score-ring-value">
              <span class="score-number">${escapeHtml(String(engagement.score ?? 0))}</span>
              <span class="score-label">Score / 100</span>
            </div>
          </div>
        </section>

        <section class="card analytics-hero-panel">
          <div class="section-title">SCUM Server</div>
          <div class="analytics-split-hero">
            <div>
              <h2>${server?.online ? 'Server online' : 'Server offline'}</h2>
              <p class="analytics-copy">${server?.online ? 'Live-Auslastung, Peak und Uptime im Survival-Takt.' : 'Zuletzt kein erreichbarer Serverstatus verfügbar.'}</p>
              <div class="analytics-kpi-inline">
                <span class="badge ${server?.online ? 'badge-online' : 'badge-offline'}">${server?.online ? 'Online' : 'Offline'}</span>
                <span class="badge badge-neutral">Peak ${fmt(this.data.status?.peak ?? 0)}</span>
                <span class="badge badge-accent">Uptime ${this.data.status?.uptimePct ?? 0}%</span>
              </div>
            </div>
            <div class="gauge-wrap">
              <canvas id="analytics-player-gauge"></canvas>
              <div class="gauge-value">
                <div class="gauge-number">${fmt(server?.playersOnline ?? 0)}/${fmt(server?.maxPlayers ?? 0)}</div>
                <div class="gauge-sub">Spieler online</div>
              </div>
            </div>
          </div>
        </section>
      </div>

      <div class="analytics-kpi-grid">
        ${analyticsKpiCard('Discord Mitglieder', fmt(guild.memberCount ?? 0), 'Serverweite Basis', null, 'accent')}
        ${analyticsKpiCard('Commands', fmt(interactions.total ?? 0), 'Ausgeführt im Zeitraum', null, 'online')}
        ${analyticsKpiCard('Fehlerquote', formatPercent(interactions.errors, interactions.total), 'Bot-Interaktionen', null, interactions.errors > 0 ? 'warning' : 'online')}
        ${analyticsKpiCard('Voice-Zeit', Charts.fmtDuration(this.data.voice?.totalSeconds ?? 0), 'Gesamt im Zeitraum', this.data.engagement?.breakdown?.voice?.delta)}
        ${analyticsKpiCard('Nachrichten', fmt(this.data.messages?.total ?? 0), 'Gesamt im Zeitraum', this.data.engagement?.breakdown?.messages?.delta)}
        ${analyticsKpiCard('Offene Tickets', fmt(this.data.tickets?.open ?? 0), 'Support-Backlog', null, this.data.tickets?.open > 0 ? 'warning' : 'online')}
      </div>
    `;

    Charts.radialScore('analytics-engagement-ring', engagement.score ?? 0);
    Charts.gauge('analytics-player-gauge', server?.playersOnline ?? 0, Math.max(server?.maxPlayers ?? 0, 1), { color: '#3bca6e' });
  },

  async renderTab() {
    const root = document.getElementById('analytics-tab-content');
    if (!root || !this.data) return;

    if (this.tab === 'teams' || this.tab === 'members') {
      await this.ensureMembers();
    }
    if (this.tab === 'settings') {
      await this.ensureSettings();
    }

    const renderers = {
      overview: () => this.renderOverviewTab(root),
      members: () => this.renderMembersTab(root),
      activity: () => this.renderActivityTab(root),
      voice: () => this.renderVoiceTab(root),
      streams: () => this.renderStreamsTab(root),
      teams: () => this.renderTeamsTab(root),
      channels: () => this.renderChannelsTab(root),
      tickets: () => this.renderTicketsTab(root),
      bot: () => this.renderBotTab(root),
      scum: () => this.renderScumTab(root),
      settings: () => this.renderSettingsTab(root),
    };

    await renderers[this.tab]();
  },

  async ensureMembers() {
    if (this.membersData) return;
    const res = await API.members();
    this.membersData = res.data?.members ?? [];
  },

  async ensureSettings() {
    if (this.settingsData) return;
    const res = await API.botSettings.list('dashboard');
    this.settingsData = res.data || {};
  },

  renderOverviewTab(root) {
    const { messages, voice, growth, heatmap, status, tickets, commands } = this.data;
    root.innerHTML = `
      <div class="analytics-grid-two">
        ${chartPanel('Nachrichten-Verlauf', '<div style="height:260px"><canvas id="hub-msg-trend"></canvas></div>')}
        ${chartPanel('Voice-Verlauf', '<div style="height:260px"><canvas id="hub-voice-trend"></canvas></div>')}
      </div>
      <div class="analytics-grid-two">
        ${chartPanel('Aktivitäts-Heatmap', '<div id="hub-overview-heatmap"></div>')}
        ${chartPanel('SCUM Spielertrend', '<div style="height:260px"><canvas id="hub-player-trend"></canvas></div>')}
      </div>
      <div class="analytics-grid-two">
        ${chartPanel('Ticket-Status', '<div style="height:260px"><canvas id="hub-ticket-status"></canvas></div>')}
        ${chartPanel('Top Commands', '<div style="height:260px"><canvas id="hub-command-chart"></canvas></div>')}
      </div>
    `;

    renderMessagesTrend('hub-msg-trend', messages.byDay);
    renderVoiceTrend('hub-voice-trend', voice.byDay);
    renderPlayerTrend('hub-player-trend', status.history);
    renderCommandChart('hub-command-chart', commands.commands);
    Charts.donutChart('hub-ticket-status', ['Offen', 'Geschlossen'], [tickets.open ?? 0, tickets.closed ?? 0], ['#e8981a', '#3bca6e']);
    Charts.heatmap('hub-overview-heatmap', heatmap.messages.map((cell) => ({ weekday: cell.weekday, hour: cell.hour, value: cell.count })), { label: 'Nachrichten', formatter: (value) => fmt(value) });
  },

  renderMembersTab(root) {
    const { overview, growth } = this.data;
    const memberCount = overview.guild?.memberCount ?? 0;
    const joins = (growth.byDay || []).reduce((sum, row) => sum + (row.joins ?? 0), 0);
    const leaves = (growth.byDay || []).reduce((sum, row) => sum + (row.leaves ?? 0), 0);
    const net = joins - leaves;
    const retention = memberCount > 0 ? Math.max(0, Math.min(100, Math.round(((memberCount - Math.max(leaves, 0)) / memberCount) * 100))) : 0;
    const roleSummary = summarizeRoles(this.membersData || []);

    root.innerHTML = `
      <div class="analytics-kpi-grid">
        ${analyticsKpiCard('Gesamtmitglieder', fmt(memberCount), 'Aktueller Discord-Bestand')}
        ${analyticsKpiCard('Joins', fmt(joins), 'Im gewählten Zeitraum', null, 'online')}
        ${analyticsKpiCard('Leaves', fmt(leaves), 'Im gewählten Zeitraum', null, leaves > joins ? 'warning' : '')}
        ${analyticsKpiCard('Netto-Wachstum', signedValue(net), 'Joins minus Leaves', null, net >= 0 ? 'online' : 'warning')}
        ${analyticsKpiCard('Retention', `${retention}%`, 'Grob aggregierter Haltewert', null, retention >= 70 ? 'online' : 'warning')}
      </div>
      <div class="analytics-grid-two">
        ${chartPanel('Join-/Leave-Trend', '<div style="height:280px"><canvas id="hub-member-growth"></canvas></div>')}
        ${chartPanel('Rollenverteilung', '<div style="height:280px"><canvas id="hub-role-distribution"></canvas></div>')}
      </div>
      ${chartPanel('Aktivitätssegmente', renderSimpleTable(['Segment', 'Mitglieder'], [
        ['Core (3+ Rollen)', fmt(roleSummary.segments.core)],
        ['Aktiv (2 Rollen)', fmt(roleSummary.segments.active)],
        ['Locker (1 Rolle)', fmt(roleSummary.segments.casual)],
        ['Ohne Rolle', fmt(roleSummary.segments.unassigned)],
      ]))}
    `;

    Charts.lineChart('hub-member-growth',
      growth.byDay.map((row) => Charts.fmtDay(row.date_ts)),
      [
        { label: 'Joins', data: growth.byDay.map((row) => row.joins ?? 0), borderColor: '#3bca6e', backgroundColor: 'rgba(59,202,110,0.1)', fill: true, tension: 0.25 },
        { label: 'Leaves', data: growth.byDay.map((row) => row.leaves ?? 0), borderColor: '#e05252', backgroundColor: 'rgba(224,82,82,0.1)', fill: true, tension: 0.25 },
      ]);

    if (roleSummary.topRoles.length) {
      Charts.donutChart('hub-role-distribution', roleSummary.topRoles.map((role) => role.name), roleSummary.topRoles.map((role) => role.count));
    } else {
      document.getElementById('hub-role-distribution').parentElement.innerHTML = emptyState('Keine Rollenverteilung verfügbar.');
    }
  },

  renderActivityTab(root) {
    const { messages, hourly, heatmap } = this.data;
    root.innerHTML = `
      <div class="analytics-kpi-grid">
        ${analyticsKpiCard('Gesamtnachrichten', fmt(messages.total ?? 0), 'Über den Zeitraum')}
        ${analyticsKpiCard('Aktive Text-Channels', fmt(messages.byChannel?.length ?? 0), 'Mit Aktivität')}
        ${analyticsKpiCard('Ø pro aktivem Tag', fmt(avgPerDay(messages.total, messages.byDay)), 'Messages / Tag')}
      </div>
      <div class="analytics-grid-two">
        ${chartPanel('Nachrichten pro Tag', '<div style="height:280px"><canvas id="hub-activity-messages"></canvas></div>')}
        ${chartPanel('Stunden-Breakdown', '<div style="height:280px"><canvas id="hub-hourly-mix"></canvas></div>')}
      </div>
      ${chartPanel('Heatmap Wochentag × Uhrzeit', '<div id="hub-activity-heatmap"></div>')}
    `;

    renderMessagesTrend('hub-activity-messages', messages.byDay);
    renderHourlyMix('hub-hourly-mix', hourly);
    Charts.heatmap('hub-activity-heatmap', heatmap.messages.map((cell) => ({ weekday: cell.weekday, hour: cell.hour, value: cell.count })), { label: 'Messages', formatter: (value) => fmt(value) });
  },

  renderVoiceTab(root) {
    const { voice, heatmap } = this.data;
    root.innerHTML = `
      <div class="analytics-kpi-grid">
        ${analyticsKpiCard('Voice gesamt', Charts.fmtDuration(voice.totalSeconds ?? 0), 'Über den Zeitraum')}
        ${analyticsKpiCard('Sessions', fmt((voice.byDay || []).reduce((sum, row) => sum + (row.session_count ?? 0), 0)), 'Voice-Sessions')}
        ${analyticsKpiCard('Ø Session', Charts.fmtDuration(avgSessionDuration(voice.byDay)), 'Durchschnittliche Dauer')}
      </div>
      <div class="analytics-grid-two">
        ${chartPanel('Voice-Zeit pro Tag', '<div style="height:280px"><canvas id="hub-voice-daily"></canvas></div>')}
        ${chartPanel('Top Voice-Channels', '<div style="height:280px"><canvas id="hub-voice-channels"></canvas></div>')}
      </div>
      ${chartPanel('Voice-Heatmap', '<div id="hub-voice-heatmap"></div>')}
    `;

    renderVoiceTrend('hub-voice-daily', voice.byDay);
    renderVoiceChannelChart('hub-voice-channels', voice.byChannel);
    Charts.heatmap('hub-voice-heatmap', heatmap.voice.map((cell) => ({ weekday: cell.weekday, hour: cell.hour, value: cell.seconds })), { label: 'Voice', formatter: (value) => Charts.fmtDuration(value) });
  },

  renderStreamsTab(root) {
    const { voice, hourly } = this.data;
    const activeHours = hourly.filter((row) => (row.stream_seconds ?? 0) > 0).length;
    root.innerHTML = `
      <div class="analytics-kpi-grid">
        ${analyticsKpiCard('Stream-Zeit', Charts.fmtDuration(voice.totalStreamSeconds ?? 0), 'Aggregiert aus Voice-Tracking')}
        ${analyticsKpiCard('Aktive Stream-Stunden', fmt(activeHours), 'Stunden mit Stream-Aktivität')}
        ${analyticsKpiCard('Peak Stream-Stunde', Charts.fmtDuration(Math.max(...hourly.map((row) => row.stream_seconds ?? 0), 0)), 'Maximaler Stundenwert')}
      </div>
      ${chartPanel('Stream-Verlauf', '<div style="height:300px"><canvas id="hub-streams-trend"></canvas></div>')}
    `;

    renderStreamTrend('hub-streams-trend', hourly);
  },

  renderTeamsTab(root) {
    const teamSummary = summarizeTeams(this.membersData || []);
    root.innerHTML = `
      <div class="analytics-kpi-grid">
        ${analyticsKpiCard('Erkannte Teams', fmt(teamSummary.totalTeams), 'Farb-/Solo-Rollen erkannt')}
        ${analyticsKpiCard('Zugeordnete Mitglieder', fmt(teamSummary.totalAssigned), 'Mit Teamrolle')}
        ${analyticsKpiCard('Solo / Orange', fmt(teamSummary.byTeam['Orange/Solo'] ?? 0), 'Solo-Rolle erkannt')}
      </div>
      <div class="analytics-grid-two">
        ${chartPanel('Team-Verteilung', '<div style="height:280px"><canvas id="hub-team-distribution"></canvas></div>')}
        ${chartPanel('Top Rollen', '<div style="height:280px"><canvas id="hub-team-roles"></canvas></div>')}
      </div>
      <div class="card analytics-note-card">
        <div class="card-title">Hinweis</div>
        <p>Team-Aktivität pro Messages/Voice/Stream wird vorbereitet, sobald Team-Rollen konsistent als Tracking-Segmente genutzt werden. Die aktuelle Ansicht zeigt bereits Verteilung und Rollenlage ohne PII.</p>
      </div>
    `;

    const teamEntries = Object.entries(teamSummary.byTeam).filter((entry) => entry[1] > 0);
    if (teamEntries.length) {
      Charts.donutChart('hub-team-distribution', teamEntries.map((entry) => entry[0]), teamEntries.map((entry) => entry[1]), ['#3bca6e', '#e05252', '#4a9eff', '#f2c94c', '#f2994a']);
      Charts.horizontalBar('hub-team-roles', teamSummary.topRoles.map((row) => row.name), teamSummary.topRoles.map((row) => row.count), '#b5162f');
    } else {
      document.getElementById('hub-team-distribution').parentElement.innerHTML = emptyState('Noch keine Team-/Farbrollen erkannt.');
      document.getElementById('hub-team-roles').parentElement.innerHTML = emptyState('Keine Rollenverteilung verfügbar.');
    }
  },

  renderChannelsTab(root) {
    const { messages, voice } = this.data;
    root.innerHTML = `
      <div class="analytics-grid-two">
        ${chartPanel('Aktivste Text-Channels', '<div style="height:320px"><canvas id="hub-text-channels"></canvas></div>')}
        ${chartPanel('Aktivste Voice-Channels', '<div style="height:320px"><canvas id="hub-voice-channel-detail"></canvas></div>')}
      </div>
      <div class="analytics-grid-two">
        ${chartPanel('Top Text-Channel KPIs', renderTopChannelCards(messages.byChannel, 'count', 'Nachrichten'))}
        ${chartPanel('Top Voice-Channel KPIs', renderTopChannelCards(voice.byChannel, 'total_seconds', 'Voice'))}
      </div>
    `;

    renderTextChannelChart('hub-text-channels', messages.byChannel);
    renderVoiceChannelChart('hub-voice-channel-detail', voice.byChannel);
  },

  renderTicketsTab(root) {
    const { tickets } = this.data;
    root.innerHTML = `
      <div class="analytics-kpi-grid">
        ${analyticsKpiCard('Tickets gesamt', fmt(tickets.total ?? 0), 'Historisch')}
        ${analyticsKpiCard('Offen', fmt(tickets.open ?? 0), 'Aktuell', null, tickets.open > 0 ? 'warning' : 'online')}
        ${analyticsKpiCard('Geschlossen', fmt(tickets.closed ?? 0), 'Historisch', null, 'online')}
        ${analyticsKpiCard('Ø Bearbeitung', Charts.fmtDuration(tickets.avgResolutionSecs ?? 0), 'Geschlossene Tickets')}
      </div>
      <div class="analytics-grid-two">
        ${chartPanel('Ticket-Volumen', '<div style="height:280px"><canvas id="hub-ticket-volume"></canvas></div>')}
        ${chartPanel('Kategorien', '<div style="height:280px"><canvas id="hub-ticket-categories"></canvas></div>')}
      </div>
      ${chartPanel('Kategorie-Details', renderSimpleTable(['Kategorie', 'Tickets'], (tickets.byCategory || []).map((row) => [row.category || 'Unkategorisiert', fmt(row.count ?? 0)])))}
    `;

    renderTicketTrend('hub-ticket-volume', tickets.byDay);
    if ((tickets.byCategory || []).length) {
      Charts.donutChart('hub-ticket-categories', tickets.byCategory.map((row) => row.category || 'Unkategorisiert'), tickets.byCategory.map((row) => row.count ?? 0));
    } else {
      document.getElementById('hub-ticket-categories').parentElement.innerHTML = emptyState('Keine Ticket-Kategorien im Zeitraum.');
    }
  },

  renderBotTab(root) {
    const { botHealth } = this.data;
    root.innerHTML = `
      <div class="analytics-kpi-grid">
        ${analyticsKpiCard('Bot-Uptime', fmtUptime(botHealth.botUptimeSec ?? 0), 'Aktuelle Laufzeit')}
        ${analyticsKpiCard('Interaktionen', fmt(botHealth.interactions?.total ?? 0), 'Commands / Buttons / Modals')}
        ${analyticsKpiCard('Fehler', fmt(botHealth.interactions?.errors ?? 0), 'Fehlgeschlagene Interaktionen', null, botHealth.interactions?.errors > 0 ? 'warning' : 'online')}
        ${analyticsKpiCard('AI-Antworten', fmt(botHealth.ai?.total ?? 0), 'Im Zeitraum')}
      </div>
      <div class="analytics-grid-two">
        ${chartPanel('Top Commands', '<div style="height:300px"><canvas id="hub-bot-commands"></canvas></div>')}
        ${chartPanel('AI-Feature-Verteilung', '<div style="height:300px"><canvas id="hub-bot-ai"></canvas></div>')}
      </div>
      ${chartPanel('Bot Health Details', renderSimpleTable(['Kennzahl', 'Wert'], [
        ['Erfolgreiche Interaktionen', fmt(botHealth.interactions?.successes ?? 0)],
        ['Unique Commands', fmt(botHealth.interactions?.uniqueCommands ?? 0)],
        ['Ø Dauer', `${fmt(Math.round(botHealth.interactions?.avgDurationMs ?? 0))} ms`],
      ]))}
    `;

    renderCommandChart('hub-bot-commands', botHealth.topCommands);
    if ((botHealth.ai?.byFeature || []).length) {
      Charts.donutChart('hub-bot-ai', botHealth.ai.byFeature.map((row) => row.feature || 'AI'), botHealth.ai.byFeature.map((row) => row.total ?? 0));
    } else {
      document.getElementById('hub-bot-ai').parentElement.innerHTML = emptyState('Keine AI-Daten im Zeitraum.');
    }
  },

  renderScumTab(root) {
    const { overview, status } = this.data;
    const server = overview.serverStatus || {};
    root.innerHTML = `
      <div class="analytics-grid-two analytics-grid-align-start">
        <section class="card analytics-hero-panel">
          <div class="section-title">SCUM Capacity</div>
          <div class="gauge-wrap">
            <canvas id="hub-scum-gauge"></canvas>
            <div class="gauge-value">
              <div class="gauge-number">${fmt(server.playersOnline ?? 0)}/${fmt(server.maxPlayers ?? 0)}</div>
              <div class="gauge-sub">Live Players</div>
            </div>
          </div>
          <div class="analytics-kpi-inline analytics-space-top">
            <span class="badge ${server.online ? 'badge-online' : 'badge-offline'}">${server.online ? 'Online' : 'Offline'}</span>
            <span class="badge badge-accent">Peak ${fmt(status.peak ?? 0)}</span>
            <span class="badge badge-neutral">Ping ${fmt(server.ping ?? 0)} ms</span>
          </div>
        </section>
        ${chartPanel('Uptime & Timeline', renderSimpleTable(['Signal', 'Wert'], [
          ['Uptime', `${status.uptimePct ?? 0}%`],
          ['Checks', fmt(status.history?.length ?? 0)],
          ['Letzter Check', server.lastCheck ? fmtDate(server.lastCheck) : '—'],
        ]))}
      </div>
      <div class="analytics-grid-two">
        ${chartPanel('Spielertrend', '<div style="height:300px"><canvas id="hub-scum-players"></canvas></div>')}
        ${chartPanel('Ping-Verlauf', '<div style="height:300px"><canvas id="hub-scum-ping"></canvas></div>')}
      </div>
    `;

    Charts.gauge('hub-scum-gauge', server.playersOnline ?? 0, Math.max(server.maxPlayers ?? 0, 1), { color: '#3bca6e' });
    renderPlayerTrend('hub-scum-players', status.history);
    renderPingTrend('hub-scum-ping', status.history);
  },

  renderSettingsTab(root) {
    const settings = this.settingsData || {};
    const fields = [
      ['Tracking aktiv', boolValue(settings.analytics_tracking_enabled?.value, true)],
      ['Public Analytics sichtbar', boolValue(settings.public_section_analytics?.value, true)],
      ['SCUM Panel sichtbar', boolValue(settings.analytics_public_show_scum?.value, true)],
      ['Engagement sichtbar', boolValue(settings.analytics_public_show_engagement?.value, true)],
      ['Update-Intervall', settings.analytics_refresh_seconds?.value || '30'],
      ['Default Zeitraum', settings.analytics_default_period?.value || '7d'],
      ['Chart-Stil', settings.analytics_chart_style?.value || 'elite'],
      ['Anonymisierte Channels', boolValue(settings.analytics_public_hide_channel_ids?.value, true)],
    ];

    root.innerHTML = `
      <div class="analytics-grid-two">
        ${chartPanel('Analytics-Konfiguration', renderSimpleTable(['Einstellung', 'Wert'], fields.map((row) => [row[0], String(row[1])])))}
        <section class="card analytics-note-card">
          <div class="card-title">Steuerung</div>
          <p>Tracking, Public-Sichtbarkeit und Darstellungsoptionen werden zentral über die Dashboard-Settings verwaltet. Änderungen werden im Audit-Log protokolliert.</p>
          <div class="analytics-actions analytics-space-top">
            <a class="btn btn-primary" href="#/settings-dashboard">Dashboard-Settings öffnen</a>
            <a class="btn btn-ghost" href="#/settings-server">Server-Settings öffnen</a>
          </div>
        </section>
      </div>
    `;
  },
};

function analyticsKpiCard(label, value, sub, delta, tone = '') {
  return `
    <div class="stat-card ${escapeHtml(tone)} analytics-kpi-card">
      <div class="stat-label">${escapeHtml(label)}</div>
      <div class="stat-value">${escapeHtml(String(value ?? '—'))}</div>
      <div class="stat-sub">${escapeHtml(sub || '')}</div>
      ${delta ? `<div class="analytics-delta ${delta.abs >= 0 ? 'up' : 'down'}">${delta.abs >= 0 ? '▲' : '▼'} ${Math.abs(delta.pct ?? 0)}%</div>` : ''}
    </div>
  `;
}

function chartPanel(title, body) {
  return `<section class="chart-card analytics-panel"><div class="card-header"><div class="card-title">${escapeHtml(title)}</div></div>${body}</section>`;
}

function renderTrendBadge(delta, label) {
  if (!delta || delta.pct == null) {
    return `<span class="badge badge-neutral">${escapeHtml(label)} —</span>`;
  }
  return `<span class="badge ${delta.abs >= 0 ? 'badge-online' : 'badge-warning'}">${escapeHtml(label)} ${delta.abs >= 0 ? '▲' : '▼'} ${Math.abs(delta.pct)}%</span>`;
}

function renderMessagesTrend(id, rows) {
  if (!rows?.length) {
    document.getElementById(id).parentElement.innerHTML = emptyState('Keine Nachrichten-Daten im Zeitraum.');
    return;
  }
  Charts.areaChart(id, rows.map((row) => Charts.fmtDay(row.date_ts)), [{ label: 'Nachrichten', data: rows.map((row) => row.count ?? 0), color: '#b5162f' }]);
}

function renderVoiceTrend(id, rows) {
  if (!rows?.length) {
    document.getElementById(id).parentElement.innerHTML = emptyState('Keine Voice-Daten im Zeitraum.');
    return;
  }
  Charts.areaChart(id, rows.map((row) => Charts.fmtDay(row.date_ts)), [{ label: 'Voice', data: rows.map((row) => Math.round((row.total_seconds ?? 0) / 360) / 10), color: '#4a9eff' }]);
}

function renderStreamTrend(id, rows) {
  if (!rows?.length) {
    document.getElementById(id).parentElement.innerHTML = emptyState('Keine Stream-Daten im Zeitraum.');
    return;
  }
  Charts.areaChart(id, rows.map((row) => fmtHourLabel(row.hour_ts)), [{ label: 'Streams', data: rows.map((row) => Math.round((row.stream_seconds ?? 0) / 360) / 10), color: '#e8981a' }]);
}

function renderPlayerTrend(id, rows) {
  const onlineRows = (rows || []).filter((row) => row.online === 1 || row.online === true);
  if (!onlineRows.length) {
    document.getElementById(id).parentElement.innerHTML = emptyState('Keine SCUM-Historie im Zeitraum.');
    return;
  }
  const sampled = sampleRows(onlineRows, 120);
  Charts.lineChart(id, sampled.map((row) => fmtHistoryLabel(row.checked_at || row.checkedAt)), [{ label: 'Spieler', data: sampled.map((row) => row.players_online ?? row.playersOnline ?? 0), borderColor: '#3bca6e', backgroundColor: 'rgba(59,202,110,0.1)', fill: true, tension: 0.25, pointRadius: 0 }]);
}

function renderPingTrend(id, rows) {
  const validRows = (rows || []).filter((row) => (row.ping ?? null) != null);
  if (!validRows.length) {
    document.getElementById(id).parentElement.innerHTML = emptyState('Keine Ping-Historie im Zeitraum.');
    return;
  }
  const sampled = sampleRows(validRows, 120);
  Charts.lineChart(id, sampled.map((row) => fmtHistoryLabel(row.checked_at || row.checkedAt)), [{ label: 'Ping', data: sampled.map((row) => row.ping ?? 0), borderColor: '#f2c94c', backgroundColor: 'rgba(242,201,76,0.1)', fill: true, tension: 0.25, pointRadius: 0 }]);
}

function renderHourlyMix(id, rows) {
  if (!rows?.length) {
    document.getElementById(id).parentElement.innerHTML = emptyState('Kein stündlicher Verlauf verfügbar.');
    return;
  }
  Charts.lineChart(id, rows.map((row) => fmtHourLabel(row.hour_ts)), [
    { label: 'Messages', data: rows.map((row) => row.message_count ?? 0), borderColor: '#b5162f', backgroundColor: 'rgba(181,22,47,0.08)', fill: true, tension: 0.2, pointRadius: 0 },
    { label: 'Voice (h)', data: rows.map((row) => Math.round((row.voice_seconds ?? 0) / 360) / 10), borderColor: '#4a9eff', backgroundColor: 'rgba(74,158,255,0.08)', fill: true, tension: 0.2, pointRadius: 0 },
  ]);
}

function renderCommandChart(id, rows) {
  if (!rows?.length) {
    document.getElementById(id).parentElement.innerHTML = emptyState('Keine Command-Daten verfügbar.');
    return;
  }
  Charts.horizontalBar(id, rows.slice(0, 8).map((row) => `/${row.command_name || 'unknown'}`), rows.slice(0, 8).map((row) => row.total ?? 0), '#b5162f');
}

function renderTextChannelChart(id, rows) {
  if (!rows?.length) {
    document.getElementById(id).parentElement.innerHTML = emptyState('Keine Text-Channel-Daten verfügbar.');
    return;
  }
  Charts.horizontalBar(id, rows.slice(0, 8).map((row) => row.channelName ? `#${row.channelName}` : shortChannel(row.channel_id)), rows.slice(0, 8).map((row) => row.count ?? 0), '#b5162f');
}

function renderVoiceChannelChart(id, rows) {
  if (!rows?.length) {
    document.getElementById(id).parentElement.innerHTML = emptyState('Keine Voice-Channel-Daten verfügbar.');
    return;
  }
  Charts.horizontalBar(id, rows.slice(0, 8).map((row) => row.channelName ? `🔊 ${row.channelName}` : shortChannel(row.channel_id)), rows.slice(0, 8).map((row) => Math.round((row.total_seconds ?? 0) / 60)), '#4a9eff');
}

function renderTicketTrend(id, rows) {
  if (!rows?.length) {
    document.getElementById(id).parentElement.innerHTML = emptyState('Keine Ticket-Historie im Zeitraum.');
    return;
  }
  Charts.lineChart(id, rows.map((row) => Charts.fmtDay(row.date_ts)), [{ label: 'Tickets', data: rows.map((row) => row.count ?? 0), borderColor: '#e8981a', backgroundColor: 'rgba(232,152,26,0.1)', fill: true, tension: 0.25 }]);
}

function renderTopChannelCards(rows, valueKey, label) {
  if (!rows?.length) return emptyState('Keine Channel-Daten im Zeitraum.');
  return `<div class="analytics-card-list">${rows.slice(0, 4).map((row) => `
    <div class="analytics-mini-card">
      <div class="analytics-mini-label">${escapeHtml(row.channelName ? row.channelName : shortChannel(row.channel_id))}</div>
      <div class="analytics-mini-value">${escapeHtml(valueKey === 'total_seconds' ? Charts.fmtDuration(row.total_seconds ?? 0) : fmt(row.count ?? 0))}</div>
      <div class="analytics-mini-sub">${escapeHtml(label)}</div>
    </div>
  `).join('')}</div>`;
}

function renderSimpleTable(headers, rows) {
  if (!rows?.length) return emptyState('Keine Daten verfügbar.');
  return `<div class="table-wrap"><table><thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead><tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(String(cell ?? '—'))}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
}

function summarizeRoles(members) {
  const roleCounts = new Map();
  let core = 0;
  let active = 0;
  let casual = 0;
  let unassigned = 0;
  for (const member of members) {
    const roles = member.roles || [];
    if (roles.length >= 3) core += 1;
    else if (roles.length === 2) active += 1;
    else if (roles.length === 1) casual += 1;
    else unassigned += 1;

    for (const role of roles) {
      roleCounts.set(role.name, (roleCounts.get(role.name) || 0) + 1);
    }
  }
  return {
    topRoles: Array.from(roleCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 6),
    segments: { core, active, casual, unassigned },
  };
}

function summarizeTeams(members) {
  const byTeam = {
    Grün: 0,
    Rot: 0,
    Blau: 0,
    Gelb: 0,
    'Orange/Solo': 0,
  };
  const roleCounts = new Map();

  for (const member of members) {
    let assigned = false;
    for (const role of member.roles || []) {
      const name = String(role.name || '').toLowerCase();
      roleCounts.set(role.name, (roleCounts.get(role.name) || 0) + 1);
      if (!assigned && /gr(ü|u)n|green/.test(name)) {
        byTeam.Grün += 1;
        assigned = true;
      } else if (!assigned && /rot|red/.test(name)) {
        byTeam.Rot += 1;
        assigned = true;
      } else if (!assigned && /blau|blue/.test(name)) {
        byTeam.Blau += 1;
        assigned = true;
      } else if (!assigned && /gelb|yellow/.test(name)) {
        byTeam.Gelb += 1;
        assigned = true;
      } else if (!assigned && /orange|solo/.test(name)) {
        byTeam['Orange/Solo'] += 1;
        assigned = true;
      }
    }
  }

  const topRoles = Array.from(roleCounts.entries()).map(([name, count]) => ({ name, count })).sort((a, b) => b.count - a.count).slice(0, 8);
  const totalAssigned = Object.values(byTeam).reduce((sum, value) => sum + value, 0);
  const totalTeams = Object.values(byTeam).filter((value) => value > 0).length;
  return { byTeam, totalAssigned, totalTeams, topRoles };
}

function sampleRows(rows, maxPoints) {
  if (rows.length <= maxPoints) return rows;
  const step = Math.ceil(rows.length / maxPoints);
  return rows.filter((_, index) => index % step === 0);
}

function fmtHistoryLabel(ts) {
  const date = new Date(ts * 1000);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

function fmtHourLabel(ts) {
  const date = new Date(ts * 1000);
  return `${String(date.getDate()).padStart(2, '0')}.${String(date.getMonth() + 1).padStart(2, '0')} ${String(date.getHours()).padStart(2, '0')}:00`;
}

function avgPerDay(total, rows) {
  return rows?.length ? Math.round((total || 0) / rows.length) : 0;
}

function avgSessionDuration(rows) {
  const totalSeconds = (rows || []).reduce((sum, row) => sum + (row.total_seconds ?? 0), 0);
  const totalSessions = (rows || []).reduce((sum, row) => sum + (row.session_count ?? 0), 0);
  return totalSessions > 0 ? Math.round(totalSeconds / totalSessions) : 0;
}

function formatPercent(part, total) {
  if (!total) return '0%';
  return `${Math.round(((part || 0) / total) * 100)}%`;
}

function shortChannel(id) {
  const suffix = String(id || '').slice(-6);
  return suffix ? `Channel • ${suffix}` : 'Channel';
}

function signedValue(value) {
  return value > 0 ? `+${fmt(value)}` : fmt(value);
}

function boolValue(value, fallback) {
  if (value == null) return fallback ? 'Ja' : 'Nein';
  const bool = value === true || value === 1 || value === '1' || value === 'true';
  return bool ? 'Ja' : 'Nein';
}
