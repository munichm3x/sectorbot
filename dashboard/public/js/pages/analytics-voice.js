// dashboard/public/js/pages/analytics-voice.js
window['page-analytics-voice'] = {
  period: '7d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Voice & Stream Analytics</h1><p>Aggregierte Voice- und Stream-Zeit — keine personenbezogenen Daten.</p></div>
      <div id="vc-period"></div>
      <div id="vc-stats" class="stat-grid"></div>
      <div class="grid-2" style="margin-top:1rem">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Voice-Zeit pro Tag (Stunden)</div><div style="height:220px"><canvas id="vc-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Top Voice-Channels</div><div style="height:220px"><canvas id="vc-channel-chart"></canvas></div></div>
      </div>
    `;
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(); });
    document.getElementById('vc-period').replaceWith(pb); pb.id = 'vc-period';
    await self.load();
  },

  async load() {
    try {
      const { data } = await API.voice(this.period);
      const { byDay, byChannel, totalSeconds, totalStreamSeconds } = data;

      document.getElementById('vc-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Voice-Zeit</div><div class="stat-value">${Charts.fmtDuration(totalSeconds)}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Stream-Zeit</div><div class="stat-value">${Charts.fmtDuration(totalStreamSeconds)}</div><div class="stat-sub">kumuliert</div></div>
        <div class="stat-card"><div class="stat-label">Sessions</div><div class="stat-value">${fmt(byDay.reduce((a,r)=>a+r.session_count,0))}</div><div class="stat-sub">Voice-Joins</div></div>
      `;

      if (byDay.length > 0) {
        Charts.lineChart('vc-daily-chart',
          byDay.map(r => Charts.fmtDay(r.date_ts)),
          [{ label: 'Voice (h)', data: byDay.map(r => Math.round(r.total_seconds / 360) / 10), borderColor: '#4a90d9', backgroundColor: 'rgba(74,144,217,0.1)', tension: 0.3, fill: true }]);
      } else {
        document.getElementById('vc-daily-chart').parentElement.innerHTML = emptyState('Noch keine Voice-Daten.');
      }

      if (byChannel.length > 0) {
        Charts.barChart('vc-channel-chart',
          byChannel.slice(0,10).map(r => r.channel_id.slice(-6)),
          byChannel.slice(0,10).map(r => Math.round(r.total_seconds / 60)),
          '#4a90d9');
      } else {
        document.getElementById('vc-channel-chart').parentElement.innerHTML = emptyState('Keine Channel-Daten.');
      }
    } catch (err) {
      document.getElementById('vc-stats').innerHTML = errorState(err.message);
    }
  },
};
