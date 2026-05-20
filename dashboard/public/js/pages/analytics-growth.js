// dashboard/public/js/pages/analytics-growth.js
window['page-analytics-growth'] = {
  period: '30d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Wachstum Analytics</h1><p>Aggregierte Join/Leave-Statistiken — keine personenbezogenen Daten.</p></div>
      <div id="gr-period"></div>
      <div id="gr-stats" class="stat-grid"></div>
      <div class="chart-card" style="margin-top:1rem"><div class="card-title" style="margin-bottom:.75rem">Joins & Leaves pro Tag</div><div style="height:250px"><canvas id="gr-chart"></canvas></div></div>
    `;
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(); });
    document.getElementById('gr-period').replaceWith(pb); pb.id = 'gr-period';
    await self.load();
  },

  async load() {
    try {
      const { data } = await API.growth(this.period);
      const { byDay } = data;
      const joins  = byDay.reduce((a, r) => a + r.joins, 0);
      const leaves = byDay.reduce((a, r) => a + r.leaves, 0);

      document.getElementById('gr-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Joins</div><div class="stat-value" style="color:var(--online)">${fmt(joins)}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Leaves</div><div class="stat-value" style="color:var(--offline)">${fmt(leaves)}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Netto</div><div class="stat-value" style="color:${joins-leaves>=0?'var(--online)':'var(--offline)'}">${joins-leaves>=0?'+':''}${joins-leaves}</div><div class="stat-sub">Wachstum</div></div>
      `;

      if (byDay.length > 0) {
        Charts.lineChart('gr-chart', byDay.map(r => Charts.fmtDay(r.date_ts)), [
          { label: 'Joins',  data: byDay.map(r => r.joins),  borderColor: '#57f287', backgroundColor: 'rgba(87,242,135,0.08)', tension: 0.3, fill: true },
          { label: 'Leaves', data: byDay.map(r => r.leaves), borderColor: '#ed4245', backgroundColor: 'rgba(237,66,69,0.08)',  tension: 0.3, fill: true },
        ]);
        // Enable legend for this multi-dataset chart
        const chart = Chart.getChart('gr-chart');
        if (chart) { chart.options.plugins.legend.display = true; chart.update(); }
      } else {
        document.getElementById('gr-chart').parentElement.innerHTML = emptyState('Noch keine Wachstumsdaten. Mitglieder-Events werden ab jetzt aufgezeichnet.');
      }
    } catch (err) {
      document.getElementById('gr-stats').innerHTML = errorState(err.message);
    }
  },
};
