window['page-server'] = {
  async render(container) {
    container.innerHTML = pageHeader('SCUM Server', 'Serverstatus', 'Live-Status, Verlauf und wichtige Serverinformationen.') + '<div id="server-content"></div>';
    const root = document.getElementById('server-content');

    try {
      const { data } = await API.server();
      const model = normalizeServerPayload(data);
      const current = model.current;

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
          ${statCard('Uptime 24h', model.uptime24h != null ? `${model.uptime24h}%` : '-', 'Aus Statuschecks')}
          ${statCard('Uptime 7 Tage', model.uptime7d != null ? `${model.uptime7d}%` : '-', 'Aus Statuschecks')}
          ${statCard('Peak 24h', model.peak24h != null ? fmt(model.peak24h) : '-', 'Höchste Spielerzahl')}
          ${statCard('Statuspunkte 24h', fmt(model.history.length), 'Gesammelte Checks')}
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
        <div class="info-grid" id="server-info-grid">${renderConfigCards(model.configCards)}</div>

        <section class="card">
          <div class="card-header"><div class="card-title">Season / Wipe Info</div></div>
          ${renderWipePanel(model.wipe)}
        </section>

        <section class="cta-panel">
          <button class="btn btn-primary" onclick="navigateTo('rules')">Regeln lesen</button>
          <button class="btn btn-ghost" onclick="navigateTo('tickets')">Support öffnen</button>
          <button class="btn btn-ghost" onclick="navigateTo('changelog')">Changelog ansehen</button>
        </section>
      `;

      const chartHistory = compactStatusHistory(model.history);
      if (chartHistory.length) {
        document.getElementById('players-chart-wrap').innerHTML = '<canvas id="players-chart"></canvas>';
        Charts.lineChart('players-chart', chartHistory.map(r => fmtTime(r.checkedAt)), [{
          label: 'Spieler',
          data: chartHistory.map(r => r.online ? r.playersOnline : null),
          borderColor: '#b5162f',
          backgroundColor: 'rgba(181,22,47,0.12)',
          tension: 0.22,
          fill: true,
          pointRadius: 0,
          pointHoverRadius: 4,
          borderWidth: 2,
          stepped: true,
          spanGaps: false,
        }], '', compactChartOptions(chartHistory));

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
          spanGaps: false,
        }], 'ms', compactChartOptions(chartHistory));
      }
    } catch {
      root.innerHTML = errorState();
    }
  },
};

function normalizeServerPayload(data) {
  const currentSource = data?.current ?? data?.status ?? null;
  const history = (Array.isArray(data?.history) ? data.history : [])
    .map(normalizeStatusPoint)
    .filter(point => point.checkedAt != null)
    .sort((a, b) => a.checkedAt - b.checkedAt);

  return {
    current: currentSource ? {
      online: currentSource.online === true || currentSource.online === 1,
      playersOnline: currentSource.playersOnline ?? currentSource.players ?? null,
      maxPlayers: currentSource.maxPlayers ?? null,
      ping: currentSource.ping ?? null,
      checkedAt: currentSource.checkedAt ?? currentSource.lastCheck ?? null,
    } : null,
    history,
    uptime24h: data?.uptime24h ?? data?.uptime?.hours24 ?? null,
    uptime7d: data?.uptime7d ?? data?.uptime?.days7 ?? null,
    peak24h: data?.peak24h ?? data?.peak?.hours24 ?? null,
    peak7d: data?.peak7d ?? data?.peak?.days7 ?? null,
    wipe: data?.wipe ?? null,
    configCards: buildServerConfigCards(data),
  };
}

function normalizeStatusPoint(point) {
  return {
    checkedAt: point?.checkedAt ?? point?.checked_at ?? point?.ts ?? null,
    online: point?.online === true || point?.online === 1,
    playersOnline: point?.playersOnline ?? point?.players_online ?? point?.players ?? null,
    maxPlayers: point?.maxPlayers ?? point?.max_players ?? null,
    ping: point?.ping ?? null,
  };
}

function buildServerConfigCards(data) {
  if (Array.isArray(data?.configCards) && data.configCards.length) {
    return data.configCards.map(card => ({
      label: String(card.label ?? ''),
      value: String(card.value ?? '—'),
      detail: card.detail ? String(card.detail) : '',
      state: card.state ? String(card.state) : '',
    }));
  }

  const cards = [];
  const info = data?.serverInfo ?? null;
  const config = data?.config ?? null;

  if (info?.serverName) cards.push({ label: 'Server', value: info.serverName, detail: info.description ?? '' });
  if (info?.gameMode) cards.push({ label: 'Spielmodus', value: info.gameMode, state: 'danger' });
  if (info?.maxTeamSize != null) cards.push({ label: 'Max Team Size', value: `${info.maxTeamSize} Spieler` });
  if (info?.soloColor) cards.push({ label: 'Solo-Farbe', value: info.soloColor });
  if (info?.lootRate) cards.push({ label: 'Loot', value: info.lootRate });
  if (info?.safezones != null) cards.push({ label: 'Safezones', value: info.safezones ? 'Ja' : 'Nein', state: info.safezones ? 'online' : 'warning' });
  if (info?.permadeath != null) cards.push({ label: 'Permadeath', value: info.permadeath ? 'Aktiv' : 'Deaktiviert', state: info.permadeath ? 'danger' : '' });
  if (info?.restartTimes) cards.push({ label: 'Restarts', value: info.restartTimes });
  if (info?.mapRegion) cards.push({ label: 'Region', value: info.mapRegion });
  if (info?.joinHint) cards.push({ label: 'Join-Hinweis', value: info.joinHint });
  if (config) {
    cards.push({ label: 'Monitoring', value: config.enabled ? 'Aktiv' : 'Inaktiv', state: config.enabled ? 'online' : 'warning' });
    if (config.host) cards.push({ label: 'Host', value: config.host });
    if (config.queryPort != null) cards.push({ label: 'Query Port', value: String(config.queryPort) });
    if (config.updateIntervalSecs != null) cards.push({ label: 'Polling', value: `${config.updateIntervalSecs}s` });
  }

  return cards;
}

function renderConfigCards(cards) {
  if (!cards.length) {
    return emptyState('Noch keine öffentlichen Serverdetails konfiguriert.', 'Sobald Server-Infos gepflegt werden, erscheinen Spielmodus, Limits und Join-Hinweise hier.');
  }

  return cards.map(card => `
    <div class="info-card ${escapeHtml(card.state ?? '')}">
      <span>${escapeHtml(card.label)}</span>
      <strong>${escapeHtml(card.value)}</strong>
      ${card.detail ? `<p>${escapeHtml(card.detail)}</p>` : ''}
    </div>
  `).join('');
}

function renderWipePanel(wipe) {
  if (!wipe) {
    return emptyState('Noch keine Wipe-Informationen konfiguriert.', 'Sobald Season-Daten gepflegt werden, erscheinen letzter Wipe, Tage seit Wipe und nächster geplanter Wipe hier.');
  }

  return `
    <div class="info-grid">
      <div class="info-card">
        <span>Season</span>
        <strong>${escapeHtml(wipe.seasonName ?? (wipe.currentSeason != null ? `Season ${wipe.currentSeason}` : 'Nicht gesetzt'))}</strong>
        ${wipe.notes ? `<p>${escapeHtml(wipe.notes)}</p>` : ''}
      </div>
      <div class="info-card">
        <span>Letzter Wipe</span>
        <strong>${escapeHtml(fmtDate(wipe.lastWipeAt))}</strong>
        <p>${escapeHtml(wipe.lastWipeType ?? 'Kein Typ hinterlegt')}</p>
      </div>
      <div class="info-card">
        <span>Nächster Wipe</span>
        <strong>${escapeHtml(fmtDate(wipe.nextWipeAt))}</strong>
        <p>${escapeHtml(wipe.nextWipeType ?? 'Noch nicht angekündigt')}</p>
      </div>
    </div>
  `;
}

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

function compactChartOptions(history) {
  const peak = Math.max(0, ...history.map(point => Number(point.playersOnline ?? 0)));
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
        suggestedMax: peak > 0 ? Math.max(10, Math.ceil(peak * 1.15)) : undefined,
      },
    },
  };
}window['page-server'] = {
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
