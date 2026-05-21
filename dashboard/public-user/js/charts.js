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

window.Charts = { lineChart, barChart, donutChart, fmtDay, fmtDuration, getCanvas };
