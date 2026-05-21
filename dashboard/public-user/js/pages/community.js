window['page-community'] = {
  async render(container) {
    container.innerHTML = pageHeader(
      'Community',
      'Sektor-13 Community',
      'Aggregierte Community-Daten ohne personenbezogene Rankings.'
    ) + '<div id="community-content"></div>';

    const root = document.getElementById('community-content');
    try {
      const { data } = await API.community();

      const memberCount = data.memberCount ?? null;
      const verified    = data.verified ?? null;
      const joins7      = data.growth?.joins7 ?? 0;
      const joins30     = data.growth?.joins30 ?? 0;
      const growthByDay = data.growth?.byDay7 ?? [];
      const textChannels  = data.topChannels?.messages ?? [];
      const voiceChannels = data.topChannels?.voice ?? [];

      // Total Voice-Time across all top voice channels (7d aggregated, best we have)
      const voiceSecs7d = voiceChannels.reduce((sum, c) => sum + (c.seconds ?? 0), 0);

      root.innerHTML = `
        <div class="stat-grid">
          ${statCard('Mitglieder', memberCount != null ? fmt(memberCount) : '-', 'Discord')}
          ${statCard('Neue Mitglieder 7 Tage', fmt(joins7), 'Aggregiert')}
          ${statCard('Neue Mitglieder 30 Tage', fmt(joins30), 'Aggregiert')}
          ${statCard('Voice 7 Tage', fmtDuration(voiceSecs7d), 'Top-Channels kumuliert')}
        </div>

        <div class="grid-2">
          <section class="chart-card">
            <div class="card-header"><div class="card-title">Mitgliederwachstum (7 Tage)</div></div>
            <div style="height:260px" id="growth-chart-wrap">${emptyState('Noch keine Wachstumsdaten gesammelt.')}</div>
          </section>
          <section class="card">
            <div class="card-header"><div class="card-title">Verifizierte Mitglieder</div></div>
            ${verified != null
              ? `<div style="padding:1rem 0;font-size:2rem;font-weight:800;font-family:var(--mono);color:var(--online)">${escapeHtml(fmt(verified))}</div>
                 <div style="font-size:0.78rem;color:var(--text-muted)">Mitglieder mit Whitelist-Rolle</div>`
              : emptyState('Whitelist-Rolle nicht konfiguriert.', 'Sobald eine Whitelist-Rolle gesetzt ist, erscheint hier der Count.')}
          </section>
        </div>

        <div class="grid-2">
          <section class="card list-card">
            <div class="card-header"><div class="card-title">Top Text-Channels (7 Tage)</div></div>
            ${renderChannelList(textChannels, 'Nachrichten', 'count', '#')}
          </section>
          <section class="card list-card">
            <div class="card-header"><div class="card-title">Top Voice-Channels (7 Tage)</div></div>
            ${renderChannelList(voiceChannels, 'min', 'seconds-to-min', '🔊')}
          </section>
        </div>
      `;

      if (growthByDay.length) {
        document.getElementById('growth-chart-wrap').innerHTML = '<canvas id="growth-chart"></canvas>';
        Charts.lineChart('growth-chart',
          growthByDay.map(r => Charts.fmtDay(r.ts)),
          [
            { label: 'Beitritte', data: growthByDay.map(r => r.joins ?? 0), borderColor: '#3bca6e', backgroundColor: 'rgba(59,202,110,0.1)', tension: 0.3, fill: true },
            { label: 'Abgänge',  data: growthByDay.map(r => r.leaves ?? 0), borderColor: '#e05252', backgroundColor: 'rgba(224,82,82,0.1)', tension: 0.3, fill: true },
          ]
        );
      }
    } catch {
      root.innerHTML = errorState();
    }
  },
};

/**
 * Render an aggregated channel list. Shows real channel name with prefix,
 * falls back to "Unbekannter Channel" if the bot can't resolve the name
 * (channel deleted or no longer in cache).
 *
 * @param channels   Array of { channelName, channelId, count|seconds }
 * @param unit       Unit label (e.g. "Nachrichten", "min")
 * @param valueMode  'count' = use .count directly, 'seconds-to-min' = .seconds / 60
 * @param prefix     Channel-name prefix icon (e.g. '#' or '🔊')
 */
function renderChannelList(channels, unit, valueMode, prefix) {
  if (!channels?.length) {
    return emptyState('Noch keine aggregierten Channel-Daten vorhanden.');
  }
  return `<div class="metric-list">${channels.slice(0, 8).map(row => {
    const name = row.channelName
      ? `${prefix}${row.channelName}`
      : 'Unbekannter Channel';
    const rawValue = valueMode === 'seconds-to-min'
      ? Math.round((row.seconds ?? 0) / 60)
      : (row.count ?? 0);
    return `<div class="metric-row"><span>${escapeHtml(name)}</span><strong>${fmt(rawValue)} ${escapeHtml(unit)}</strong></div>`;
  }).join('')}</div>`;
}
