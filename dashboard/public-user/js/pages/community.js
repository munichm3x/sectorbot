window['page-community'] = {
  async render(container) {
    container.innerHTML = pageHeader('Community', 'Sektor-13 Community', 'Aggregierte Community-Daten ohne personenbezogene Rankings.') + '<div id="community-content"></div>';
    const root = document.getElementById('community-content');
    try {
      const { data } = await API.community();
      root.innerHTML = `
        <div class="stat-grid">
          ${statCard('Mitglieder', data.guild ? fmt(data.guild.memberCount) : '-', data.guild?.name ?? 'Discord')}
          ${statCard('Neue Mitglieder 7 Tage', fmt(data.newMembers7d ?? 0), 'Aggregiert')}
          ${statCard('Neue Mitglieder 30 Tage', fmt(data.newMembers30d ?? 0), 'Aggregiert')}
          ${statCard('Voice 7 Tage', fmtDuration(data.voiceSecs ?? 0), 'Aggregiert')}
        </div>

        <div class="grid-2">
          <section class="chart-card">
            <div class="card-header"><div class="card-title">Mitgliederwachstum</div></div>
            <div style="height:260px" id="growth-chart-wrap">${emptyState('Noch keine Wachstumsdaten gesammelt.')}</div>
          </section>
          <section class="card">
            <div class="card-header"><div class="card-title">Teamverteilung</div></div>
            ${emptyState('Noch keine sichere Teamverteilung verfügbar.', 'Sobald Teamrollen sauber auswertbar sind, erscheinen hier nur aggregierte Zahlen.')}
          </section>
        </div>

        <div class="grid-2">
          <section class="card list-card">
            <div class="card-header"><div class="card-title">Text-Channels aggregiert</div></div>
            ${renderChannelList(data.textChannels, 'Nachrichten')}
          </section>
          <section class="card list-card">
            <div class="card-header"><div class="card-title">Voice-Channels aggregiert</div></div>
            ${renderChannelList((data.voiceChannels ?? []).map(c => ({ channel_id: c.channel_id, count: Math.round((c.total_seconds ?? 0) / 60) })), 'Minuten')}
          </section>
        </div>
      `;

      if (data.growth?.length) {
        document.getElementById('growth-chart-wrap').innerHTML = '<canvas id="growth-chart"></canvas>';
        Charts.lineChart('growth-chart', data.growth.map(r => Charts.fmtDay(r.date_ts)), [
          { label: 'Beitritte', data: data.growth.map(r => r.joins ?? 0), borderColor: '#3bca6e', backgroundColor: 'rgba(59,202,110,0.1)', tension: 0.3, fill: true },
          { label: 'Abgänge', data: data.growth.map(r => r.leaves ?? 0), borderColor: '#e05252', backgroundColor: 'rgba(224,82,82,0.1)', tension: 0.3, fill: true },
        ]);
      }
    } catch {
      root.innerHTML = errorState();
    }
  },
};

function renderChannelList(channels, unit) {
  if (!channels?.length) return emptyState('Noch keine aggregierten Channel-Daten vorhanden.');
  return `<div class="metric-list">${channels.slice(0, 8).map(row => `
    <div class="metric-row"><span>Channel ${escapeHtml(String(row.channel_id).slice(-6))}</span><strong>${fmt(row.count ?? row.total_seconds ?? 0)} ${escapeHtml(unit)}</strong></div>
  `).join('')}</div>`;
}
