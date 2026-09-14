import Chart from 'chart.js/auto';
import { makeShiftData, movingAverage, scenarioProjection, toCsv } from '../../src/lib/core.js';

const data = makeShiftData();
const zoneSelect = document.querySelector('#zone');
const deltaInput = document.querySelector('#staff-delta');
const deltaOutput = document.querySelector('#delta-output');
const status = document.querySelector('#dashboard-status');
const table = document.querySelector('#signal-table');
const metricWorkload = document.querySelector('#kpi-workload');
const metricCoverage = document.querySelector('#kpi-coverage');
const metricInspection = document.querySelector('#kpi-inspection');
const metricRisk = document.querySelector('#kpi-risk');
const scenarioCurrent = document.querySelector('#scenario-current');
const scenarioProjected = document.querySelector('#scenario-projected');
const scenarioHours = document.querySelector('#scenario-hours');
const scenarioImpact = document.querySelector('#scenario-impact');
let trendChart;

[...new Set(data.map((row) => row.zone))].forEach((zone) => {
  const option = document.createElement('option');
  option.value = zone;
  option.textContent = zone;
  zoneSelect.append(option);
});

function average(records, key) {
  return records.reduce((sum, row) => sum + row[key], 0) / Math.max(1, records.length);
}

function activeData() {
  return zoneSelect.value === 'All' ? data : data.filter((row) => row.zone === zoneSelect.value);
}

function anomaly(row) {
  const reasons = [];
  if (row.coverage < 80) reasons.push('low coverage');
  if (row.backlog > 5) reasons.push('backlog');
  if (row.incidents) reasons.push('incident');
  return reasons.length ? reasons.join(', ') : 'normal';
}

function renderChart(records) {
  const recent = records.slice(-30);
  const forecast = movingAverage(recent.map((row) => row.workload), 6);
  const config = {
    type: 'line',
    data: {
      labels: recent.map((row) => 'H' + row.hour),
      datasets: [
        { label: 'Workload', data: recent.map((row) => row.workload), borderColor: '#f5fff6', backgroundColor: 'transparent', tension: 0.25 },
        { label: 'Moving average', data: forecast.map((value) => Math.round(value)), borderColor: '#39ff14', borderDash: [6, 5], tension: 0.3 },
        { label: 'Coverage %', data: recent.map((row) => row.coverage), borderColor: '#ffb020', backgroundColor: 'transparent', tension: 0.25 }
      ]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { intersect: false, mode: 'index' },
      plugins: { legend: { labels: { color: '#dce8de' } } },
      scales: {
        x: { ticks: { color: '#91a596', maxTicksLimit: 10 }, grid: { color: 'rgba(255,255,255,.05)' } },
        y: { ticks: { color: '#91a596' }, grid: { color: 'rgba(255,255,255,.05)' }, suggestedMin: 40, suggestedMax: 120 }
      }
    }
  };
  if (trendChart) trendChart.destroy();
  trendChart = new Chart(document.querySelector('#trend-chart'), config);
}

function render() {
  const records = activeData();
  const staffDelta = Number(deltaInput.value);
  const projection = scenarioProjection(records, staffDelta);
  const workload = Math.round(average(records, 'workload'));
  const coverage = Math.round(average(records, 'coverage'));
  const inspection = Math.round(average(records, 'inspection'));

  metricWorkload.textContent = String(workload);
  metricCoverage.textContent = coverage + '%';
  metricInspection.textContent = inspection + '%';
  metricRisk.textContent = projection.backlogRisk;
  metricRisk.className = projection.backlogRisk === 'High' ? 'failure' : projection.backlogRisk === 'Moderate' ? 'warning' : 'success';
  scenarioCurrent.textContent = projection.currentCoverage + '%';
  scenarioProjected.textContent = projection.projectedCoverage + '%';
  scenarioHours.textContent = (projection.laborHours >= 0 ? '+' : '') + projection.laborHours + ' h';
  scenarioImpact.textContent = (projection.serviceImpact >= 0 ? '+' : '') + projection.serviceImpact + ' pts';
  deltaOutput.textContent = (staffDelta >= 0 ? '+' : '') + staffDelta;

  table.replaceChildren();
  records.slice(-10).reverse().forEach((row) => {
    const tr = document.createElement('tr');
    [row.hour, row.zone, row.workload, row.staff, row.coverage + '%', row.backlog, row.inspection + '%', anomaly(row)].forEach((value) => {
      const td = document.createElement('td');
      td.textContent = String(value);
      tr.append(td);
    });
    table.append(tr);
  });
  renderChart(records);
  status.textContent = (zoneSelect.value === 'All' ? 'All synthetic zones' : zoneSelect.value) + ' · scenario recalculated.';
}

zoneSelect.addEventListener('change', render);
deltaInput.addEventListener('input', render);
document.querySelector('#reset').addEventListener('click', () => {
  zoneSelect.value = 'All';
  deltaInput.value = '0';
  render();
});
document.querySelector('#export').addEventListener('click', () => {
  const csv = '# SYNTHETIC DEMO DATA — NOT FOR OPERATIONAL USE\n' + toCsv(activeData());
  const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
  const link = document.createElement('a');
  link.href = url;
  link.download = 'shiftlens-synthetic-data.csv';
  link.click();
  URL.revokeObjectURL(url);
  status.textContent = 'Synthetic CSV exported.';
});

render();