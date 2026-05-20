// dashboard/public/js/pages/analytics-tickets.js
window['page-analytics-tickets'] = {
  period: '30d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Ticket Analytics</h1><p>Aggregierte Ticket-Statistiken.</p></div>
      <div id="ta-period"></div>
      <div id="ta-stats" class="stat-grid"></div>
      <div class="grid-2" style="margin-top:1rem">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Tickets pro Tag</div><div style="height:220px"><canvas id="ta-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nach Kategorie</div><div style="height:220px"><canvas id="ta-cat-chart"></canvas></div></div>
      </div>
    `;
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(); });
    document.getElementById('ta-period').replaceWith(pb); pb.id = 'ta-period';
    await self.load();
  },

  async load() {
    try {
      const { data } = await API.ticketStats(this.period);
      const { total, open, closed, byCategory, byDay, avgResolutionSecs } = data;

      document.getElementById('ta-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Gesamt</div><div class="stat-value">${total}</div><div class="stat-sub">alle Tickets</div></div>
        <div class="stat-card"><div class="stat-label">Offen</div><div class="stat-value" style="color:var(--warning)">${open}</div><div class="stat-sub">aktiv</div></div>
        <div class="stat-card"><div class="stat-label">Geschlossen</div><div class="stat-value" style="color:var(--online)">${closed}</div><div class="stat-sub">abgeschlossen</div></div>
        <div class="stat-card"><div class="stat-label">Ø Lösungszeit</div><div class="stat-value">${avgResolutionSecs ? Charts.fmtDuration(avgResolutionSecs) : '—'}</div><div class="stat-sub">Ø Dauer</div></div>
      `;

      if (byDay.length > 0) {
        Charts.lineChart('ta-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)),
          [{ label: 'Tickets', data: byDay.map(r => r.count), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]);
      } else {
        document.getElementById('ta-daily-chart').parentElement.innerHTML = emptyState('Noch keine Daten.');
      }

      if (byCategory.length > 0) {
        Charts.donutChart('ta-cat-chart', byCategory.map(r => r.category), byCategory.map(r => r.count));
      } else {
        document.getElementById('ta-cat-chart').parentElement.innerHTML = emptyState('Keine Kategoriedaten.');
      }
    } catch (err) {
      document.getElementById('ta-stats').innerHTML = errorState(err.message);
    }
  },
};
