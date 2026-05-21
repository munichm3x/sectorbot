// dashboard/public/js/charts.js
// Chart.js global defaults and factory functions.

Chart.defaults.color           = '#9090a0';
Chart.defaults.borderColor     = '#1e1e28';
Chart.defaults.font.family     = 'system-ui, sans-serif';
Chart.defaults.font.size       = 11;
Chart.defaults.plugins.legend.display = false;
Chart.defaults.plugins.tooltip.backgroundColor = '#18181e';
Chart.defaults.plugins.tooltip.borderColor     = '#1e1e28';
Chart.defaults.plugins.tooltip.borderWidth     = 1;
Chart.defaults.plugins.tooltip.titleColor      = '#e8e8ee';
Chart.defaults.plugins.tooltip.bodyColor       = '#9090a0';
Chart.defaults.plugins.tooltip.padding         = 10;

const ACCENT  = '#8b0000';
const ONLINE  = '#57f287';
const WARNING = '#faa61a';

/** Destroy existing chart on a canvas, return canvas element. */
function getCanvas(id) {
  const el = document.getElementById(id);
  if (!el) return null;
  const existing = Chart.getChart(el);
  if (existing) existing.destroy();
  return el;
}

/** Format unix timestamp (seconds) to "DD.MM." */
function fmtDay(ts) {
  const d = new Date(ts * 1000);
  return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.`;
}

/** Format seconds to "Xh Ym" */
function fmtDuration(secs) {
  if (!secs) return '0s';
  const h = Math.floor(secs / 3600);
  const m = Math.floor((secs % 3600) / 60);
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Line chart: daily timeseries */
function lineChart(id, labels, datasets, yLabel = '', overrides = {}) {
  const el = getCanvas(id);
  if (!el) return null;
  return new Chart(el, {
    type: 'line',
    data: { labels, datasets },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: datasets.length > 1 } },
      scales: {
        x: { grid: { color: '#1e1e2820' } },
        y: {
          beginAtZero: true,
          grid: { color: '#1e1e2820' },
          title: yLabel ? { display: true, text: yLabel, color: '#505060' } : { display: false },
        },
      },
      ...overrides,
    },
  });
}

/** Bar chart: category comparison */
function barChart(id, labels, data, color = ACCENT) {
  const el = getCanvas(id);
  if (!el) return null;
  return new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{ data, backgroundColor: color + '99', borderColor: color, borderWidth: 1, borderRadius: 3 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#1e1e2820' } },
      },
    },
  });
}

/** Donut chart */
function donutChart(id, labels, data, colors) {
  const el = getCanvas(id);
  if (!el) return null;
  return new Chart(el, {
    type: 'doughnut',
    data: {
      labels,
      datasets: [{ data, backgroundColor: colors ?? [ACCENT, ONLINE, WARNING, '#4a90d9', '#b36b00'], borderWidth: 0, hoverOffset: 4 }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '65%',
      plugins: { legend: { display: true, position: 'right' } },
    },
  });
}

/** Area chart with filled gradient. datasets: [{ label, data, color }] */
function areaChart(id, labels, datasets) {
  const el = getCanvas(id);
  if (!el) return null;
  const ctx = el.getContext('2d');
  return new Chart(el, {
    type: 'line',
    data: {
      labels,
      datasets: datasets.map(d => {
        const color = d.color || ACCENT;
        const grad = ctx.createLinearGradient(0, 0, 0, el.offsetHeight || 220);
        grad.addColorStop(0, color + '55');
        grad.addColorStop(1, color + '00');
        return {
          label: d.label || '',
          data: d.data,
          borderColor: color,
          backgroundColor: grad,
          tension: 0.35,
          fill: true,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
        };
      }),
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: { legend: { display: datasets.length > 1, position: 'bottom', labels: { boxWidth: 8, boxHeight: 8, padding: 12 } } },
      scales: {
        x: { grid: { display: false } },
        y: { beginAtZero: true, grid: { color: '#ffffff08' } },
      },
    },
  });
}

/** Horizontal bar chart for top-N lists */
function horizontalBar(id, labels, data, color, opts = {}) {
  const el = getCanvas(id);
  if (!el) return null;
  const c = color || ACCENT;
  return new Chart(el, {
    type: 'bar',
    data: {
      labels,
      datasets: [{
        data,
        backgroundColor: c + '99',
        borderColor: c,
        borderWidth: 1,
        borderRadius: 4,
        barThickness: opts.thickness || 16,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: opts.tooltipFormatter ? { label: (item) => opts.tooltipFormatter(item.raw, item.label) } : undefined },
      },
      scales: {
        x: { beginAtZero: true, grid: { color: '#ffffff08' } },
        y: { grid: { display: false }, ticks: { autoSkip: false } },
      },
    },
  });
}

/** Semi-circular gauge for capacity-like metrics (e.g. SCUM players online) */
function gauge(id, value, max, opts = {}) {
  const el = getCanvas(id);
  if (!el) return null;
  const v = Math.max(0, Math.min(max, value));
  const rest = Math.max(0, max - v);
  const ratio = max > 0 ? v / max : 0;
  // Color thresholds: < 30% online, 30-70% warning, > 70% accent
  const color = ratio > 0.85 ? '#e05252' : ratio > 0.6 ? '#3bca6e' : opts.color || ACCENT;
  return new Chart(el, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [v, rest],
        backgroundColor: [color, '#1e213340'],
        borderWidth: 0,
        circumference: 180,
        rotation: 270,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '75%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
  });
}

/** Full circular score ring (0-100) */
function radialScore(id, score, opts = {}) {
  const el = getCanvas(id);
  if (!el) return null;
  const v = Math.max(0, Math.min(100, score));
  // Tier colors: 0-30 dim, 30-60 amber, 60-80 accent, 80+ green
  const color = v >= 80 ? '#3bca6e' : v >= 60 ? (opts.color || '#b5162f') : v >= 30 ? '#e8981a' : '#4a5070';
  return new Chart(el, {
    type: 'doughnut',
    data: {
      datasets: [{
        data: [v, 100 - v],
        backgroundColor: [color, '#1e213340'],
        borderWidth: 0,
        circumference: 360,
        rotation: -90,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '78%',
      plugins: {
        legend: { display: false },
        tooltip: { enabled: false },
      },
    },
  });
}

/**
 * Activity heatmap: 7 weekdays × 24 hours grid.
 * @param {string} containerId  ID of a <div> (NOT canvas — this is HTML-based)
 * @param {Array}  data         Array of { weekday: 0-6, hour: 0-23, value: number }
 * @param {object} opts         { color: hex string for accent, label: 'Nachrichten' | 'Minuten', formatter: fn(value) }
 */
function heatmap(containerId, data, opts = {}) {
  const el = document.getElementById(containerId);
  if (!el) return null;
  const color = opts.color || ACCENT;
  const label = opts.label || '';
  const formatter = opts.formatter || ((v) => String(v));
  const weekdays = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

  // Build lookup
  const lookup = new Map();
  let max = 0;
  for (const d of data) {
    const key = `${d.weekday}-${d.hour}`;
    const value = d.value ?? d.count ?? d.seconds ?? 0;
    lookup.set(key, value);
    if (value > max) max = value;
  }

  // Hex to rgb for opacity blending
  const m = color.match(/^#([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i);
  const r = m ? parseInt(m[1], 16) : 181;
  const g = m ? parseInt(m[2], 16) : 22;
  const b = m ? parseInt(m[3], 16) : 47;

  // Build grid HTML
  let html = '<div class="heatmap-grid">';
  // Header row: hours
  html += '<div class="heatmap-corner"></div>';
  for (let h = 0; h < 24; h++) {
    html += `<div class="heatmap-hour-label">${h % 3 === 0 ? h.toString().padStart(2, '0') : '·'}</div>`;
  }
  // Body: 7 rows × 24 cells
  for (let day = 0; day < 7; day++) {
    html += `<div class="heatmap-day-label">${weekdays[day]}</div>`;
    for (let hour = 0; hour < 24; hour++) {
      const value = lookup.get(`${day}-${hour}`) || 0;
      const intensity = max > 0 ? value / max : 0;
      const alpha = intensity === 0 ? 0.04 : 0.15 + intensity * 0.7;
      const title = `${weekdays[day]} ${String(hour).padStart(2,'0')}:00 — ${formatter(value)}${label ? ' ' + label : ''}`;
      html += `<div class="heatmap-cell" style="background:rgba(${r},${g},${b},${alpha})" title="${title}"></div>`;
    }
  }
  html += '</div>';

  // Legend
  html += '<div class="heatmap-legend">';
  html += '<span class="heatmap-legend-label">weniger</span>';
  for (let i = 0; i < 5; i++) {
    const alpha = i === 0 ? 0.04 : 0.15 + (i / 4) * 0.7;
    html += `<span class="heatmap-legend-cell" style="background:rgba(${r},${g},${b},${alpha})"></span>`;
  }
  html += '<span class="heatmap-legend-label">mehr</span>';
  html += '</div>';

  el.innerHTML = html;
  return { max, label };
}

window.Charts = {
  lineChart, barChart, donutChart, areaChart, horizontalBar,
  gauge, radialScore, heatmap,
  fmtDay, fmtDuration, getCanvas,
};
