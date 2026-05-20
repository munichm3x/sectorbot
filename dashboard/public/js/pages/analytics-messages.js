// dashboard/public/js/pages/analytics-messages.js
window['page-analytics-messages'] = {
  period: '7d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Nachrichten Analytics</h1><p>Aggregierte Nachrichtenaktivität — kein Nachrichteninhalt gespeichert.</p></div>
      <div id="msg-period"></div>
      <div id="msg-stats" class="stat-grid" style="margin-bottom:1rem"></div>
      <div class="grid-2">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nachrichten pro Tag</div><div style="height:220px"><canvas id="msg-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Top Channels</div><div style="height:220px"><canvas id="msg-channel-chart"></canvas></div></div>
      </div>
    `;

    // Period selector
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(container); });
    document.getElementById('msg-period').replaceWith(pb);
    pb.id = 'msg-period';

    await self.load(container);
  },

  async load(container) {
    const statsEl   = document.getElementById('msg-stats');
    const dailyEl   = document.getElementById('msg-daily-chart')?.parentElement;
    const channelEl = document.getElementById('msg-channel-chart')?.parentElement;
    if (!statsEl) return;
    statsEl.innerHTML = '<div class="skeleton" style="height:80px;grid-column:1/-1"></div>';

    try {
      const { data } = await API.messages(this.period);
      const { byDay, byChannel, total } = data;

      statsEl.innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${fmt(total)}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Aktive Channels</div><div class="stat-value">${byChannel.length}</div><div class="stat-sub">mit Aktivität</div></div>
        <div class="stat-card"><div class="stat-label">Ø pro Tag</div><div class="stat-value">${byDay.length > 0 ? fmt(Math.round(total / byDay.length)) : '—'}</div><div class="stat-sub">Tagesdurchschnitt</div></div>
      `;

      if (byDay.length === 0) {
        dailyEl.innerHTML = emptyState('Noch keine Daten für diesen Zeitraum.');
      } else {
        dailyEl.innerHTML = '<canvas id="msg-daily-chart"></canvas>';
        Charts.lineChart('msg-daily-chart',
          byDay.map(r => Charts.fmtDay(r.date_ts)),
          [{ label: 'Nachrichten', data: byDay.map(r => r.count), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]);
      }

      if (byChannel.length === 0) {
        channelEl.innerHTML = emptyState('Keine Channel-Daten.');
      } else {
        channelEl.innerHTML = '<canvas id="msg-channel-chart"></canvas>';
        Charts.barChart('msg-channel-chart',
          byChannel.slice(0,10).map(r => r.channel_id.slice(-6)),
          byChannel.slice(0,10).map(r => r.count));
      }
    } catch (err) {
      statsEl.innerHTML = errorState(err.message);
    }
  },
};
