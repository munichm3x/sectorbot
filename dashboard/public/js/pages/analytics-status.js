// dashboard/public/js/pages/analytics-status.js
window['page-analytics-status'] = {
  period: '7d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>Serverstatus Analytics</h1><p>SCUM-Server-Verfügbarkeit und Spielerzahlen im Zeitverlauf.</p></div>
      <div id="ss-period"></div>
      <div id="ss-stats" class="stat-grid"></div>
      <div class="section-header" style="margin-top:1.5rem"><div class="section-title">Verlauf & Aufschlüsselung</div></div>
      <div class="chart-card"><div class="card-header"><div class="card-title">Spieler online (Verlauf)</div></div><div style="height:250px"><canvas id="ss-players-chart"></canvas></div></div>
    `;
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(); });
    document.getElementById('ss-period').replaceWith(pb); pb.id = 'ss-period';
    await self.load();
  },

  async load() {
    try {
      const { data } = await API.statusHistory(this.period);
      const { history, peak, uptimePct } = data;

      document.getElementById('ss-stats').innerHTML = `
        <div class="stat-card online"><div class="stat-label">Uptime</div><div class="stat-value">${uptimePct !== null ? uptimePct+'%' : '—'}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card accent"><div class="stat-label">Peak Spieler</div><div class="stat-value">${peak ?? '—'}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Checks</div><div class="stat-value">${fmt(history.length)}</div><div class="stat-sub">Status-Abfragen</div></div>
      `;

      const onlineHistory = history.filter(r => r.online === 1);
      if (onlineHistory.length > 0) {
        // Sample down to max 200 points for chart
        const step = Math.max(1, Math.floor(history.length / 200));
        const sampled = history.filter((_, i) => i % step === 0);
        Charts.lineChart('ss-players-chart',
          sampled.map(r => {
            const d = new Date(r.checked_at * 1000);
            return `${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
          }),
          [{ label: 'Spieler', data: sampled.map(r => r.players_online ?? 0), borderColor: '#57f287', backgroundColor: 'rgba(87,242,135,0.08)', tension: 0.2, fill: true, pointRadius: 0 }]
        );
      } else {
        document.getElementById('ss-players-chart').parentElement.innerHTML = emptyState('Noch keine Verlaufsdaten. Status wird bei jedem Check gespeichert.');
      }
    } catch (err) {
      document.getElementById('ss-stats').innerHTML = errorState(err.message);
    }
  },
};
