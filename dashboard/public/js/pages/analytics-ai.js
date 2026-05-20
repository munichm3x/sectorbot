// dashboard/public/js/pages/analytics-ai.js
window['page-analytics-ai'] = {
  period: '7d',
  async render(container) {
    const self = this;
    container.innerHTML = `
      <div class="page-header"><h1>AI Usage Analytics</h1><p>Aggregierte KI-Nutzung — keine Prompt-Inhalte gespeichert.</p></div>
      <div id="ai-period"></div>
      <div id="ai-stats" class="stat-grid"></div>
      <div class="grid-2" style="margin-top:1rem">
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Requests pro Tag</div><div style="height:220px"><canvas id="ai-daily-chart"></canvas></div></div>
        <div class="chart-card"><div class="card-title" style="margin-bottom:.75rem">Nach Feature</div><div style="height:220px"><canvas id="ai-feat-chart"></canvas></div></div>
      </div>
      <div class="card" style="margin-top:1rem">
        <div class="card-title" style="margin-bottom:.75rem">Feature-Aufschlüsselung</div>
        <div id="ai-table"></div>
      </div>
    `;
    const pb = periodBar(self.period, (p) => { self.period = p; self.load(); });
    document.getElementById('ai-period').replaceWith(pb); pb.id = 'ai-period';
    await self.load();
  },

  async load() {
    try {
      const { data } = await API.ai(this.period);
      const { byFeature, byDay, total } = data;
      const successes = byFeature.reduce((a,r) => a + r.successes, 0);

      document.getElementById('ai-stats').innerHTML = `
        <div class="stat-card"><div class="stat-label">Requests</div><div class="stat-value">${fmt(total)}</div><div class="stat-sub">${this.period}</div></div>
        <div class="stat-card"><div class="stat-label">Erfolgsrate</div><div class="stat-value">${total > 0 ? Math.round(successes/total*100) : 0}%</div><div class="stat-sub">success</div></div>
        <div class="stat-card"><div class="stat-label">Features</div><div class="stat-value">${byFeature.length}</div><div class="stat-sub">aktiv</div></div>
      `;

      if (byDay.length > 0) {
        Charts.lineChart('ai-daily-chart', byDay.map(r => Charts.fmtDay(r.date_ts)),
          [{ label: 'Requests', data: byDay.map(r => r.total), borderColor: '#8b0000', backgroundColor: 'rgba(139,0,0,0.1)', tension: 0.3, fill: true }]);
      } else {
        document.getElementById('ai-daily-chart').parentElement.innerHTML = emptyState('Noch keine AI-Daten.');
      }

      if (byFeature.length > 0) {
        Charts.donutChart('ai-feat-chart', byFeature.map(r => r.feature), byFeature.map(r => r.total));
        document.getElementById('ai-table').innerHTML = `
          <div class="table-wrap"><table>
            <thead><tr><th>Feature</th><th>Total</th><th>Erfolge</th><th>Fehler</th><th>Ø Dauer</th></tr></thead>
            <tbody>${byFeature.map(r => `
              <tr>
                <td class="mono">${r.feature}</td>
                <td>${r.total}</td>
                <td style="color:var(--online)">${r.successes}</td>
                <td style="color:${r.errors>0?'var(--offline)':'var(--text-muted)'}">${r.errors}</td>
                <td class="mono dim">${r.avg_duration_ms ? r.avg_duration_ms+'ms' : '—'}</td>
              </tr>
            `).join('')}</tbody>
          </table></div>
        `;
      } else {
        document.getElementById('ai-feat-chart').parentElement.innerHTML = emptyState('Keine AI-Features aktiv.');
        document.getElementById('ai-table').innerHTML = emptyState('Noch keine AI-Daten vorhanden.');
      }
    } catch (err) {
      document.getElementById('ai-stats').innerHTML = errorState(err.message);
    }
  },
};
