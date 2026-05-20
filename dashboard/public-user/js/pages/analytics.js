// dashboard/public-user/js/pages/analytics.js
// Tab-based analytics page with 6 tabs: Nachrichten, Voice, Wachstum, Tickets, Server, AI

window['page-analytics'] = {
  activeTab: 'messages',
  periods: { messages: '7d', voice: '7d', growth: '7d', tickets: '7d', server: '7d', ai: '7d' },

  async render(container) {
    const self = this;
    const tabs = [
      { id: 'messages', label: 'Nachrichten' },
      { id: 'voice',    label: 'Voice' },
      { id: 'growth',   label: 'Wachstum' },
      { id: 'tickets',  label: 'Tickets' },
      { id: 'server',   label: 'Server' },
      { id: 'ai',       label: 'AI' },
    ];

    container.innerHTML = `
      <div class="page-header"><h1>Server Analytics</h1><p>Aggregierte Serverstatistiken für alle Mitglieder.</p></div>
      <div class="tab-bar" id="analytics-tabs">
        ${tabs.map(t => `<button class="tab-btn${t.id === self.activeTab ? ' active' : ''}" data-tab="${t.id}">${t.label}</button>`).join('')}
      </div>
      <div id="analytics-body"></div>
    `;

    container.querySelector('#analytics-tabs').addEventListener('click', (e) => {
      const btn = e.target.closest('.tab-btn');
      if (!btn) return;
      self.activeTab = btn.dataset.tab;
      container.querySelectorAll('.tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === self.activeTab));
      self.loadTab(self.activeTab);
    });

    await self.loadTab(self.activeTab);
  },

  async loadTab(tab) {
    const self = this;
    const body = document.getElementById('analytics-body');
    if (!body) return;
    const period = self.periods[tab] ?? '7d';

    if (tab === 'messages') await self.loadMessages(body, period);
    else if (tab === 'voice')   await self.loadVoice(body, period);
    else if (tab === 'growth')  await self.loadGrowth(body, period);
    else if (tab === 'tickets') await self.loadTickets(body, period);
    else if (tab === 'server')  await self.loadServer(body, period);
    else if (tab === 'ai')      await self.loadAi(body, period);
  },

  _periodBar(tab, body) {
    const self = this;
    const pb = periodBar(self.periods[tab], (p) => {
      self.periods[tab] = p;
      self.loadTab(tab);
    });
    body.prepend(pb);
  },

  async loadMessages(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="msg-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="grid-2">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nachrichten pro Tag</div><div style="height:220px"><canvas id="msg-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Top Channels</div><div style="height:220px"><canvas id="msg-channel-chart"></canvas></div></div>
      </div>
    `;
    self._periodBar('messages', body);
    try {
      const { data } = await API.messages(period);
      const { byDay, byChannel, total } = data;
      document.getElementById('msg-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${escapeHtml(fmt(total))}</div><div class="stat-sub">${escapeHtml(period)}</div></div>
        <div class="stat-card"><div class="stat-label">Aktive Channels</div><div class="stat-value">${escapeHtml(String(byChannel.length))}</div></div>
        <div class="stat-card"><div class="stat-label">Ø pro Tag</div><div class="stat-value">${byDay.length > 0 ? escapeHtml(fmt(Math.round(total / byDay.length))) : '—'}</div></div>
      `;
      const dailyWrap = document.getElementById('msg-daily-chart')?.parentElement;
      const chanWrap  = document.getElementById('msg-channel-chart')?.parentElement;
      if (byDay.length === 0) { dailyWrap.innerHTML = emptyState(); }
      else { dailyWrap.innerHTML = '<canvas id="msg-daily-chart"></canvas>'; Charts.lineChart('msg-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [{ label: 'Nachrichten', data: byDay.map(r => r.count), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]); }
      if (byChannel.length === 0) { chanWrap.innerHTML = emptyState(); }
      else { chanWrap.innerHTML = '<canvas id="msg-channel-chart"></canvas>'; Charts.barChart('msg-channel-chart', byChannel.slice(0,10).map(r => r.channel_id.slice(-6)), byChannel.slice(0,10).map(r => r.count)); }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },

  async loadVoice(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="voice-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="grid-2">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Voice-Minuten pro Tag</div><div style="height:220px"><canvas id="voice-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Top Channels</div><div style="height:220px"><canvas id="voice-channel-chart"></canvas></div></div>
      </div>
    `;
    self._periodBar('voice', body);
    try {
      const { data } = await API.voice(period);
      const { byDay, byChannel, totalSeconds } = data;
      document.getElementById('voice-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${escapeHtml(fmt(Math.round(totalSeconds / 60)))}</div><div class="stat-sub">Minuten</div></div>
        <div class="stat-card"><div class="stat-label">Aktive Channels</div><div class="stat-value">${escapeHtml(String(byChannel.length))}</div></div>
        <div class="stat-card"><div class="stat-label">Ø pro Tag</div><div class="stat-value">${byDay.length > 0 ? escapeHtml(fmt(Math.round(totalSeconds / 60 / byDay.length))) : '—'}</div><div class="stat-sub">Minuten</div></div>
      `;
      const dailyWrap = document.getElementById('voice-daily-chart')?.parentElement;
      const chanWrap  = document.getElementById('voice-channel-chart')?.parentElement;
      if (byDay.length === 0) { dailyWrap.innerHTML = emptyState(); }
      else { dailyWrap.innerHTML = '<canvas id="voice-daily-chart"></canvas>'; Charts.lineChart('voice-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [{ label: 'Minuten', data: byDay.map(r => Math.round(r.total_seconds / 60)), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]); }
      if (byChannel.length === 0) { chanWrap.innerHTML = emptyState(); }
      else { chanWrap.innerHTML = '<canvas id="voice-channel-chart"></canvas>'; Charts.barChart('voice-channel-chart', byChannel.slice(0,8).map(r => r.channel_id.slice(-6)), byChannel.slice(0,8).map(r => Math.round(r.total_seconds / 60))); }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },

  async loadGrowth(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="growth-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Mitgliederentwicklung</div><div style="height:260px"><canvas id="growth-chart"></canvas></div></div>
    `;
    self._periodBar('growth', body);
    try {
      const { data } = await API.growth(period);
      const { byDay } = data;
      const joins  = byDay.reduce((s, r) => s + (r.joins  ?? 0), 0);
      const leaves = byDay.reduce((s, r) => s + (r.leaves ?? 0), 0);
      document.getElementById('growth-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Beitritte</div><div class="stat-value">${escapeHtml(fmt(joins))}</div><div class="stat-sub">${escapeHtml(period)}</div></div>
        <div class="stat-card"><div class="stat-label">Abgänge</div><div class="stat-value">${escapeHtml(fmt(leaves))}</div><div class="stat-sub">${escapeHtml(period)}</div></div>
        <div class="stat-card"><div class="stat-label">Netto</div><div class="stat-value">${joins - leaves >= 0 ? '+' : ''}${escapeHtml(fmt(joins - leaves))}</div></div>
      `;
      const wrap = document.getElementById('growth-chart')?.parentElement;
      if (byDay.length === 0) { wrap.innerHTML = emptyState(); }
      else {
        wrap.innerHTML = '<canvas id="growth-chart"></canvas>';
        Charts.lineChart('growth-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [
          { label: 'Beitritte', data: byDay.map(r => r.joins ?? 0),  borderColor: '#22c55e', backgroundColor: 'rgba(34,197,94,0.1)',  tension: 0.3, fill: true },
          { label: 'Abgänge',   data: byDay.map(r => r.leaves ?? 0), borderColor: '#ed4245', backgroundColor: 'rgba(237,66,69,0.1)', tension: 0.3, fill: true },
        ]);
      }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },

  async loadTickets(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="ticket-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="grid-2">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Tickets pro Tag</div><div style="height:220px"><canvas id="ticket-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nach Kategorie</div><div style="height:220px"><canvas id="ticket-cat-chart"></canvas></div></div>
      </div>
    `;
    self._periodBar('tickets', body);
    try {
      const { data } = await API.tickets(period);
      const { total, open, closed, byDay, byCategory } = data;
      document.getElementById('ticket-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${escapeHtml(fmt(total))}</div></div>
        <div class="stat-card"><div class="stat-label">Offen</div><div class="stat-value">${escapeHtml(fmt(open))}</div></div>
        <div class="stat-card"><div class="stat-label">Geschlossen</div><div class="stat-value">${escapeHtml(fmt(closed))}</div></div>
      `;
      const dailyWrap = document.getElementById('ticket-daily-chart')?.parentElement;
      const catWrap   = document.getElementById('ticket-cat-chart')?.parentElement;
      if (byDay.length === 0) { dailyWrap.innerHTML = emptyState(); }
      else { dailyWrap.innerHTML = '<canvas id="ticket-daily-chart"></canvas>'; Charts.lineChart('ticket-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [{ label: 'Tickets', data: byDay.map(r => r.count), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]); }
      if (byCategory.length === 0) { catWrap.innerHTML = emptyState(); }
      else { catWrap.innerHTML = '<canvas id="ticket-cat-chart"></canvas>'; Charts.barChart('ticket-cat-chart', byCategory.map(r => escapeHtml(r.category)), byCategory.map(r => r.count)); }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },

  async loadServer(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="server-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Spieler Online (Verlauf)</div><div style="height:260px"><canvas id="server-chart"></canvas></div></div>
    `;
    self._periodBar('server', body);
    try {
      const { data } = await API.statusHistory(period);
      const { history, peak, uptimePct } = data;
      document.getElementById('server-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Peak Spieler</div><div class="stat-value">${escapeHtml(fmt(peak?.players_online ?? 0))}</div></div>
        <div class="stat-card"><div class="stat-label">Uptime</div><div class="stat-value">${uptimePct != null ? escapeHtml(String(uptimePct)) + '%' : '—'}</div></div>
        <div class="stat-card"><div class="stat-label">Checks</div><div class="stat-value">${escapeHtml(fmt(history.length))}</div></div>
      `;
      const wrap = document.getElementById('server-chart')?.parentElement;
      if (history.length === 0) { wrap.innerHTML = emptyState(); }
      else {
        wrap.innerHTML = '<canvas id="server-chart"></canvas>';
        Charts.lineChart('server-chart',
          history.map(r => Charts.fmtDay(r.checked_at)),
          [{ label: 'Spieler', data: history.map(r => r.online ? r.players_online : null), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.1, fill: true, spanGaps: false }]);
      }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },

  async loadAi(body, period) {
    const self = this;
    body.innerHTML = `
      <div id="ai-stats" class="stat-grid" style="margin:1rem 0"></div>
      <div class="grid-2">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">AI Anfragen pro Tag</div><div style="height:220px"><canvas id="ai-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nach Feature</div><div style="height:220px"><canvas id="ai-feature-chart"></canvas></div></div>
      </div>
    `;
    self._periodBar('ai', body);
    try {
      const { data } = await API.ai(period);
      const { byDay, byFeature, total } = data;
      document.getElementById('ai-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${escapeHtml(fmt(total))}</div><div class="stat-sub">Anfragen</div></div>
        <div class="stat-card"><div class="stat-label">Ø pro Tag</div><div class="stat-value">${byDay.length > 0 ? escapeHtml(fmt(Math.round(total / byDay.length))) : '—'}</div></div>
      `;
      const dailyWrap   = document.getElementById('ai-daily-chart')?.parentElement;
      const featureWrap = document.getElementById('ai-feature-chart')?.parentElement;
      if (byDay.length === 0) { dailyWrap.innerHTML = emptyState(); }
      else { dailyWrap.innerHTML = '<canvas id="ai-daily-chart"></canvas>'; Charts.lineChart('ai-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [{ label: 'Anfragen', data: byDay.map(r => r.count), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]); }
      if (byFeature.length === 0) { featureWrap.innerHTML = emptyState(); }
      else { featureWrap.innerHTML = '<canvas id="ai-feature-chart"></canvas>'; Charts.barChart('ai-feature-chart', byFeature.map(r => escapeHtml(r.feature)), byFeature.map(r => r.count)); }
    } catch (err) { body.innerHTML = errorState(err.message); }
  },
};
