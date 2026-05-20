// dashboard/public/js/pages/ai.js
window['page-ai'] = {
  async render(container) {
    container.innerHTML = `
      <div class="page-header"><h1>AI</h1><p>KI-Features und aggregierte Nutzungsübersicht — keine Prompt-Inhalte.</p></div>
      <div id="ai-overview"><div class="skeleton tall"></div></div>
    `;

    try {
      const [{ data: ai7d }, { data: ai24h }] = await Promise.all([API.ai('7d'), API.ai('24h')]);
      const features7d = ai7d.byFeature;
      const successes  = features7d.reduce((a,r) => a+r.successes, 0);
      const errors     = features7d.reduce((a,r) => a+r.errors, 0);

      document.getElementById('ai-overview').innerHTML = `
        <div class="stat-grid">
          <div class="stat-card"><div class="stat-label">24h Requests</div><div class="stat-value">${fmt(ai24h.total)}</div></div>
          <div class="stat-card"><div class="stat-label">7d Requests</div><div class="stat-value">${fmt(ai7d.total)}</div></div>
          <div class="stat-card"><div class="stat-label">Erfolgsrate</div><div class="stat-value">${ai7d.total > 0 ? Math.round(successes/(successes+errors)*100) : 0}%</div><div class="stat-sub">7 Tage</div></div>
          <div class="stat-card"><div class="stat-label">Fehler 7d</div><div class="stat-value" style="color:${errors>0?'var(--offline)':'var(--online)'}">${fmt(errors)}</div></div>
        </div>
        <div class="card" style="margin-top:1rem">
          <div class="card-title" style="margin-bottom:.75rem">Aktive Features (7 Tage)</div>
          ${features7d.length === 0 ? emptyState('Noch keine AI-Nutzung aufgezeichnet.') : `
            <div class="table-wrap"><table>
              <thead><tr><th>Feature</th><th>Requests</th><th>Erfolge</th><th>Fehler</th><th>Ø Dauer</th></tr></thead>
              <tbody>${features7d.map(r => `
                <tr>
                  <td class="mono">${escapeHtml(r.feature)}</td>
                  <td>${r.total}</td>
                  <td style="color:var(--online)">${r.successes}</td>
                  <td style="color:${r.errors>0?'var(--offline)':'var(--text-muted)'}">${r.errors}</td>
                  <td class="mono dim">${r.avg_duration_ms ? r.avg_duration_ms+'ms' : '—'}</td>
                </tr>
              `).join('')}</tbody>
            </table></div>
          `}
        </div>
        <div class="card" style="margin-top:1rem">
          <div class="card-title" style="margin-bottom:.5rem">Hinweis</div>
          <p style="font-size:.82rem;color:var(--text-secondary)">API-Keys werden niemals im Dashboard angezeigt oder geloggt. Prompt-Inhalte werden nicht gespeichert. Nur aggregierte Metadaten (Feature, Dauer, Erfolg/Fehler) sind sichtbar.</p>
        </div>
      `;
    } catch (err) {
      document.getElementById('ai-overview').innerHTML = errorState(err.message);
    }
  },
};
