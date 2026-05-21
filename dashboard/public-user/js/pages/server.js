window['page-server'] = {
  async render(container) {
    container.innerHTML = pageHeader('SCUM Server', 'Serverstatus', 'Live-Status, Verlauf und wichtige Serverinformationen.') + '<div id="server-content"></div>';
    const root = document.getElementById('server-content');
    try {
      const { data } = await API.server();
      const current = data.current;
      root.innerHTML = `
        <section class="server-hero card">
          <div class="server-hero-main">
            <div class="kicker">Live Status</div>
            <h2>${current?.online ? 'Server online' : 'Server offline oder noch nicht erfasst'}</h2>
            <div class="server-status-line">${statusBadge(current?.online)}<span>Letzter Check: ${fmtDate(current?.checkedAt)}</span></div>
          </div>
          <div class="server-hero-stats">
            <div><span>Spieler</span><strong>${current ? `${fmt(current.playersOnline)}/${fmt(current.maxPlayers)}` : '-'}</strong></div>
            <div><span>Ping</span><strong>${current?.ping != null ? `${current.ping} ms` : '-'}</strong></div>
          </div>
        </section>

        <div class="stat-grid">
          ${statCard('Uptime 24h', data.uptime24h != null ? `${data.uptime24h}%` : '-', 'Aus Statuschecks')}
          ${statCard('Uptime 7 Tage', data.uptime7d != null ? `${data.uptime7d}%` : '-', 'Aus Statuschecks')}
          ${statCard('Statuspunkte 24h', fmt(data.history?.length ?? 0), 'Gesammelte Checks')}
        </div>

        <div class="grid-2">
          <section class="chart-card">
            <div class="card-header"><div class="card-title">Spieler Verlauf 24h</div></div>
            <div style="height:260px" id="players-chart-wrap">${emptyState('Der Spielerstatus wird angezeigt, sobald Daten gesammelt wurden.')}</div>
          </section>
          <section class="chart-card">
            <div class="card-header"><div class="card-title">Ping Verlauf 24h</div></div>
            <div style="height:260px" id="ping-chart-wrap">${emptyState('Der Pingverlauf wird angezeigt, sobald Daten gesammelt wurden.')}</div>
          </section>
        </div>

        <div class="section-header"><div class="section-title">Server-Konfiguration</div></div>
        <div class="info-grid">${(data.config ?? []).map(card => `<div class="info-card ${escapeHtml(card.state ?? '')}"><span>${escapeHtml(card.label)}</span><strong>${escapeHtml(card.value)}</strong></div>`).join('')}</div>

        <section class="card">
          <div class="card-header"><div class="card-title">Season / Wipe Info</div></div>
          ${emptyState('Noch keine Wipe-Informationen konfiguriert.', 'Sobald Season-Daten gepflegt werden, erscheinen letzter Wipe, Tage seit Wipe und nächster geplanter Wipe hier.')}
        </section>

        <section class="cta-panel">
          <button class="btn btn-primary" onclick="navigateTo('rules')">Regeln lesen</button>
          <button class="btn btn-ghost" onclick="navigateTo('tickets')">Support öffnen</button>
          <button class="btn btn-ghost" onclick="navigateTo('changelog')">Changelog ansehen</button>
        </section>
      `;

      const chartHistory = compactStatusHistory(data.history ?? []);
      if (chartHistory.length) {
        document.getElementById('players-chart-wrap').innerHTML = '<canvas id="players-chart"></canvas>';
        Charts.lineChart('players-chart', chartHistory.map(r => fmtTime(r.checkedAt)), [{
          label: 'Spieler',
          data: chartHistory.map(r => r.online ? r.playersOnline : null),
          borderColor: '#b5162f',
          backgroundColor: 'rgba(181,22,47,0.12)',
          tension: 0.25,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          stepped: true,
          spanGaps: false
        }], '', compactChartOptions());
        document.getElementById('ping-chart-wrap').innerHTML = '<canvas id="ping-chart"></canvas>';
        Charts.lineChart('ping-chart', chartHistory.map(r => fmtTime(r.checkedAt)), [{
          label: 'Ping',
          data: chartHistory.map(r => r.online && r.ping > 0 ? r.ping : null),
          borderColor: '#d6a443',
          backgroundColor: 'rgba(214,164,67,0.1)',
          tension: 0.25,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          spanGaps: false
        }], 'ms', compactChartOptions());
      }
    } catch {
      root.innerHTML = errorState();
    }
  },
};

function compactStatusHistory(history) {
  const bucketSize = 30 * 60;
  const buckets = new Map();
  history.forEach(point => {
    if (!point?.checkedAt) return;
    const bucket = Math.floor(point.checkedAt / bucketSize) * bucketSize;
    const current = buckets.get(bucket) ?? {
      checkedAt: bucket,
      onlineSamples: 0,
      offlineSamples: 0,
      playerMax: null,
      pingSum: 0,
      pingSamples: 0,
    };
    if (point.online) {
      current.onlineSamples += 1;
      if (point.playersOnline != null) {
        current.playerMax = current.playerMax == null ? point.playersOnline : Math.max(current.playerMax, point.playersOnline);
      }
      if (point.ping != null && point.ping > 0) {
        current.pingSum += point.ping;
        current.pingSamples += 1;
      }
    } else {
      current.offlineSamples += 1;
    }
    buckets.set(bucket, current);
  });

  return Array.from(buckets.values())
    .sort((a, b) => a.checkedAt - b.checkedAt)
    .map(bucket => ({
      checkedAt: bucket.checkedAt,
      online: bucket.onlineSamples >= bucket.offlineSamples,
      playersOnline: bucket.playerMax,
      ping: bucket.pingSamples ? Math.round(bucket.pingSum / bucket.pingSamples) : null,
    }));
}

function fmtTime(ts) {
  return new Date(ts * 1000).toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
}

function compactChartOptions() {
  return {
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        grid: { color: '#1e1e2820' },
        ticks: {
          autoSkip: true,
          maxTicksLimit: 8,
          maxRotation: 0,
          minRotation: 0,
        },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#1e1e2820' },
        ticks: { precision: 0 },
      },
    },
  };
}
