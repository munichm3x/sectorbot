// dashboard/public-user/js/pages/statistik.js
window['page-statistik'] = {
  period: '7d',

  async render(container) {
    const self = this;
    container.innerHTML = pageHeader(
      'Statistik',
      'Community Statistik',
      'Aggregierte, anonymisierte Aktivitäts-Statistiken. Keine personenbezogenen Daten.'
    );
    container.innerHTML += `
      <div id="stat-period-bar" style="margin-bottom:1rem"></div>
      <div id="stat-content"><div class="skeleton" style="height:500px"></div></div>
    `;

    const periodBarEl = periodBar(self.period, (p) => {
      self.period = p;
      self.load();
    });
    document.getElementById('stat-period-bar').replaceWith(periodBarEl);
    periodBarEl.id = 'stat-period-bar';

    await self.load();
  },

  async load() {
    const root = document.getElementById('stat-content');
    if (!root) return;
    root.innerHTML = `<div class="skeleton" style="height:400px"></div>`;

    try {
      const [engRes, msgRes, voiceRes, growthRes, statusRes, communityRes, heatmapRes] = await Promise.all([
        API.engagement(this.period),
        API.messages(this.period),
        API.voice(this.period),
        API.growth(this.period),
        API.statusHistory(this.period).catch(() => ({ data: null })),
        API.community().catch(() => ({ data: null })),
        API.heatmap(this.period).catch(() => ({ data: null })),
      ]);

      const eng = engRes.data || {};
      const messages = msgRes.data || {};
      const voice = voiceRes.data || {};
      const growth = growthRes.data || {};
      const status = statusRes.data || null;
      const community = communityRes.data || null;
      const heatmap = heatmapRes.data || null;

      this.renderAll(root, { eng, messages, voice, growth, status, community, heatmap });
    } catch (err) {
      root.innerHTML = errorState();
    }
  },

  renderAll(root, d) {
    const { eng, messages, voice, growth, status, community, heatmap } = d;

    // === Build all sections ===
    root.innerHTML = `
      ${this.renderHero(eng, community)}
      ${this.renderActivityHeatmap()}
      ${this.renderTimeseriesGrid()}
      ${this.renderTopChannels(community)}
      ${this.renderServerSection(status)}
      ${this.renderGrowthSection()}
    `;

    // === Render charts (after DOM insert) ===
    // 1. Engagement ring
    if (eng.score != null) {
      Charts.radialScore('stat-engagement-ring', eng.score);
    }

    // 2. Heatmap (messages)
    if (heatmap?.messages) {
      Charts.heatmap('stat-heatmap-msg',
        heatmap.messages.map(c => ({ weekday: c.weekday, hour: c.hour, value: c.count })),
        { label: 'Nachrichten', formatter: (v) => fmt(v) }
      );
    } else {
      document.getElementById('stat-heatmap-msg').innerHTML = emptyState('Noch keine Aktivitätsdaten.');
    }

    // 3. Heatmap (voice)
    if (heatmap?.voice) {
      Charts.heatmap('stat-heatmap-voice',
        heatmap.voice.map(c => ({ weekday: c.weekday, hour: c.hour, value: c.seconds })),
        { label: 'Voice-Zeit', formatter: (v) => Charts.fmtDuration(v) }
      );
    } else {
      document.getElementById('stat-heatmap-voice').innerHTML = emptyState('Noch keine Voice-Daten.');
    }

    // 4. Messages by day (area chart)
    if (messages.byDay?.length) {
      Charts.areaChart('stat-messages-chart',
        messages.byDay.map(r => Charts.fmtDay(r.date_ts)),
        [{ label: 'Nachrichten', data: messages.byDay.map(r => r.count), color: '#b5162f' }]
      );
    } else {
      document.getElementById('stat-messages-chart').parentElement.innerHTML = emptyState('Keine Nachrichten-Daten.');
    }

    // 5. Voice by day (area chart, hours)
    if (voice.byDay?.length) {
      Charts.areaChart('stat-voice-chart',
        voice.byDay.map(r => Charts.fmtDay(r.date_ts)),
        [{ label: 'Voice (Stunden)', data: voice.byDay.map(r => Math.round((r.total_seconds ?? 0) / 360) / 10), color: '#4a9eff' }]
      );
    } else {
      document.getElementById('stat-voice-chart').parentElement.innerHTML = emptyState('Keine Voice-Daten.');
    }

    // 6. Server players over time
    if (status?.history?.length) {
      const points = compactServerHistory(status.history, this.period).slice(-180);
      Charts.lineChart('stat-players-chart',
        points.map(h => {
          const d = new Date(h.checkedAt * 1000);
          return `${String(d.getDate()).padStart(2, '0')}.${String(d.getMonth()+1).padStart(2,'0')} ${String(d.getHours()).padStart(2,'0')}:${String(d.getMinutes()).padStart(2,'0')}`;
        }),
        [{ label: 'Spieler', data: points.map(h => h.online ? h.playersOnline ?? 0 : null), borderColor: '#3bca6e', backgroundColor: 'rgba(59,202,110,0.1)', tension: 0.22, fill: true, stepped: true, pointRadius: 0, pointHoverRadius: 4, spanGaps: false }],
        '',
        serverChartOptions(points, status)
      );
    } else {
      const el = document.getElementById('stat-players-chart');
      if (el) el.parentElement.innerHTML = emptyState('Keine Status-Historie.');
    }

    // 7. Top text channels (horizontal bar)
    if (community?.topChannels?.messages?.length) {
      const items = community.topChannels.messages.slice(0, 8);
      Charts.horizontalBar('stat-top-text',
        items.map(c => c.channelName ? `#${c.channelName}` : 'Unbekannt'),
        items.map(c => c.count),
        '#b5162f',
        { tooltipFormatter: (v, label) => `${label}: ${fmt(v)} Nachrichten` }
      );
    } else {
      const el = document.getElementById('stat-top-text');
      if (el) el.parentElement.innerHTML = emptyState('Keine Channel-Daten.');
    }

    // 8. Top voice channels
    if (community?.topChannels?.voice?.length) {
      const items = community.topChannels.voice.slice(0, 8);
      Charts.horizontalBar('stat-top-voice',
        items.map(c => c.channelName ? `🔊 ${c.channelName}` : 'Unbekannt'),
        items.map(c => Math.round((c.seconds ?? 0) / 60)),
        '#4a9eff',
        { tooltipFormatter: (v, label) => `${label}: ${fmt(v)} min` }
      );
    } else {
      const el = document.getElementById('stat-top-voice');
      if (el) el.parentElement.innerHTML = emptyState('Keine Voice-Channel-Daten.');
    }

    // 9. Growth chart (joins vs leaves)
    if (growth.byDay?.length) {
      Charts.lineChart('stat-growth-chart',
        growth.byDay.map(r => Charts.fmtDay(r.date_ts)),
        [
          { label: 'Beitritte', data: growth.byDay.map(r => r.joins ?? 0), borderColor: '#3bca6e', backgroundColor: 'rgba(59,202,110,0.1)', tension: 0.3, fill: true },
          { label: 'Abgänge',  data: growth.byDay.map(r => r.leaves ?? 0), borderColor: '#e05252', backgroundColor: 'rgba(224,82,82,0.1)', tension: 0.3, fill: true },
        ]
      );
    } else {
      const el = document.getElementById('stat-growth-chart');
      if (el) el.parentElement.innerHTML = emptyState('Keine Wachstumsdaten.');
    }
  },

  // === Section renderers (return HTML strings) ===

  renderHero(eng, community) {
    const score = eng.score ?? 0;
    const tier = score >= 80 ? 'Sehr aktiv' : score >= 60 ? 'Aktiv' : score >= 30 ? 'Ruhig' : 'Sehr ruhig';
    const msgDelta = eng.breakdown?.messages?.delta;
    const voiceDelta = eng.breakdown?.voice?.delta;
    const joinDelta = eng.breakdown?.joins?.delta;

    return `
      <div class="hero-card" style="margin-bottom:1.5rem">
        <div class="hero-status-row" style="align-items:center">
          <div>
            <div class="hero-status-name">Engagement Score</div>
            <div class="hero-status-meta">${escapeHtml(tier)} — basiert auf Aktivität, Voice-Zeit und Mitglieder-Wachstum</div>
          </div>
          <div class="score-ring-wrap">
            <canvas id="stat-engagement-ring"></canvas>
            <div class="score-ring-value">
              <span class="score-number">${escapeHtml(String(score))}</span>
              <span class="score-label">/ 100</span>
            </div>
          </div>
        </div>
        <div class="hero-metrics" style="margin-top:1.25rem">
          ${this.renderHeroMetric('Nachrichten', eng.breakdown?.messages?.value ?? 0, msgDelta, (v) => fmt(v))}
          ${this.renderHeroMetric('Voice-Zeit', eng.breakdown?.voice?.value ?? 0, voiceDelta, (v) => Charts.fmtDuration(v))}
          ${this.renderHeroMetric('Neue Mitglieder', eng.breakdown?.joins?.value ?? 0, joinDelta, (v) => fmt(v))}
          ${community ? this.renderHeroMetric('Gesamtmitglieder', community.memberCount ?? 0, null, (v) => fmt(v)) : ''}
        </div>
      </div>
    `;
  },

  renderHeroMetric(label, value, delta, formatter) {
    const formatted = formatter(value);
    let deltaHtml = '';
    if (delta && delta.pct != null) {
      const positive = delta.abs >= 0;
      const arrow = positive ? '▲' : '▼';
      const color = positive ? 'var(--online)' : 'var(--offline)';
      deltaHtml = `<div style="font-size:0.7rem;font-weight:600;color:${color};margin-top:0.25rem">${arrow} ${Math.abs(delta.pct)}%</div>`;
    }
    return `
      <div class="hero-metric">
        <div class="hero-metric-label">${escapeHtml(label)}</div>
        <div class="hero-metric-value">${escapeHtml(formatted)}</div>
        ${deltaHtml}
      </div>
    `;
  },

  renderActivityHeatmap() {
    return `
      <div class="section-header"><div class="section-title">Aktivitäts-Heatmap (Wochentag × Uhrzeit)</div></div>
      <div class="grid-2">
        <div class="chart-card">
          <div class="card-header"><div class="card-title">Nachrichten</div></div>
          <div id="stat-heatmap-msg" style="min-height:160px"></div>
        </div>
        <div class="chart-card">
          <div class="card-header"><div class="card-title">Voice-Zeit</div></div>
          <div id="stat-heatmap-voice" style="min-height:160px"></div>
        </div>
      </div>
    `;
  },

  renderTimeseriesGrid() {
    return `
      <div class="section-header" style="margin-top:1.5rem"><div class="section-title">Verlauf</div></div>
      <div class="grid-2">
        <div class="chart-card">
          <div class="card-header"><div class="card-title">Nachrichten pro Tag</div></div>
          <div style="height:220px"><canvas id="stat-messages-chart"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="card-header"><div class="card-title">Voice-Zeit pro Tag</div></div>
          <div style="height:220px"><canvas id="stat-voice-chart"></canvas></div>
        </div>
      </div>
    `;
  },

  renderTopChannels(community) {
    if (!community) return '';
    return `
      <div class="section-header" style="margin-top:1.5rem"><div class="section-title">Top Channels (7 Tage)</div></div>
      <div class="grid-2">
        <div class="chart-card">
          <div class="card-header"><div class="card-title">Text-Channels</div></div>
          <div style="height:260px"><canvas id="stat-top-text"></canvas></div>
        </div>
        <div class="chart-card">
          <div class="card-header"><div class="card-title">Voice-Channels (Minuten)</div></div>
          <div style="height:260px"><canvas id="stat-top-voice"></canvas></div>
        </div>
      </div>
    `;
  },

  renderServerSection(status) {
    if (!status) return '';
    const latest = Array.isArray(status.history) && status.history.length ? normalizeStatusPoint(status.history[status.history.length - 1]) : null;
    return `
      <div class="section-header" style="margin-top:1.5rem"><div class="section-title">SCUM Server</div></div>
      <div class="stat-grid">
        <div class="stat-card accent"><div class="stat-label">Peak Spieler</div><div class="stat-value">${escapeHtml(String(status.peak ?? '—'))}</div></div>
        <div class="stat-card online"><div class="stat-label">Uptime</div><div class="stat-value">${escapeHtml(String(status.uptimePct ?? 0))}<small style="font-size:0.85rem">%</small></div></div>
        <div class="stat-card ${latest?.online ? 'online' : 'warning'}"><div class="stat-label">Zuletzt erfasst</div><div class="stat-value">${latest ? escapeHtml(String(latest.playersOnline ?? 0)) : '—'}</div><div class="stat-sub">${latest ? `Spieler · ${fmtDate(latest.checkedAt)}` : 'Noch kein Snapshot'}</div></div>
      </div>
      <div class="chart-card" style="margin-top:1rem">
        <div class="card-header"><div class="card-title">Spieler-Verlauf</div></div>
        <div style="height:240px"><canvas id="stat-players-chart"></canvas></div>
      </div>
    `;
  },

  renderGrowthSection() {
    return `
      <div class="section-header" style="margin-top:1.5rem"><div class="section-title">Community-Wachstum</div></div>
      <div class="chart-card">
        <div class="card-header"><div class="card-title">Beitritte vs. Abgänge</div></div>
        <div style="height:240px"><canvas id="stat-growth-chart"></canvas></div>
      </div>
    `;
  },
};

function normalizeStatusPoint(point) {
  return {
    checkedAt: point?.checkedAt ?? point?.checked_at ?? point?.ts ?? null,
    online: point?.online === true || point?.online === 1,
    playersOnline: point?.playersOnline ?? point?.players_online ?? point?.players ?? null,
    maxPlayers: point?.maxPlayers ?? point?.max_players ?? null,
    ping: point?.ping ?? null,
  };
}

function compactServerHistory(history, period) {
  const bucketSecs = period === '24h' ? 900 : period === '7d' ? 3600 : period === '30d' ? 10800 : 21600;
  const buckets = new Map();

  history.forEach(rawPoint => {
    const point = normalizeStatusPoint(rawPoint);
    if (!point.checkedAt) return;
    const bucketTs = Math.floor(point.checkedAt / bucketSecs) * bucketSecs;
    const entry = buckets.get(bucketTs) ?? {
      checkedAt: bucketTs,
      online: false,
      playersOnline: null,
      maxPlayers: null,
      pingSum: 0,
      pingSamples: 0,
    };

    entry.online = entry.online || point.online;
    entry.playersOnline = point.playersOnline == null
      ? entry.playersOnline
      : entry.playersOnline == null
        ? point.playersOnline
        : Math.max(entry.playersOnline, point.playersOnline);
    entry.maxPlayers = point.maxPlayers ?? entry.maxPlayers;
    if (point.ping != null && point.ping > 0) {
      entry.pingSum += point.ping;
      entry.pingSamples += 1;
    }

    buckets.set(bucketTs, entry);
  });

  return Array.from(buckets.values())
    .sort((a, b) => a.checkedAt - b.checkedAt)
    .map(entry => ({
      checkedAt: entry.checkedAt,
      online: entry.online,
      playersOnline: entry.playersOnline,
      maxPlayers: entry.maxPlayers,
      ping: entry.pingSamples ? Math.round(entry.pingSum / entry.pingSamples) : null,
    }));
}

function serverChartOptions(points, status) {
  const peak = Math.max(0, status?.peak ?? 0, ...points.map(point => Number(point.playersOnline ?? 0)));
  return {
    interaction: { mode: 'index', intersect: false },
    scales: {
      x: {
        grid: { color: '#1e1e2820' },
        ticks: { autoSkip: true, maxTicksLimit: 10, maxRotation: 0, minRotation: 0 },
      },
      y: {
        beginAtZero: true,
        grid: { color: '#1e1e2820' },
        ticks: { precision: 0 },
        suggestedMax: peak > 0 ? Math.max(10, Math.ceil(peak * 1.15)) : undefined,
      },
    },
  };
}
