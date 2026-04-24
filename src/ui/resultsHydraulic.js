import { formatNumber } from '../core/units.js';

function renderTable(headers, rows) {
  const headMarkup = headers.map((item) => `<th>${item}</th>`).join('');
  const rowMarkup = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
  return `<div class="table-scroll"><table><thead><tr>${headMarkup}</tr></thead><tbody>${rowMarkup}</tbody></table></div>`;
}

export function renderSummary(container, result) {
  container.innerHTML = [
    ['Resolved flow rate', `${formatNumber(result.flowRate, 5)} m3/s`],
    ['Static head', `${formatNumber(result.staticHead, 4)} m`],
    ['Suction loss', `${formatNumber(result.suction.totalHeadLoss, 4)} m`],
    ['Discharge loss', `${formatNumber(result.discharge.totalHeadLoss, 4)} m`],
    ['Total system head', `${formatNumber(result.totalHead, 4)} m`],
    ['NPSHA', `${formatNumber(result.npsha, 4)} m`]
  ].map(([label, value]) => `
    <article class="summary-card">
      <span class="label">${label}</span>
      <strong>${value}</strong>
    </article>
  `).join('');
}

export function renderSideAudit(container, sideResult) {
  const segmentRows = (sideResult.segmentResults || []).map((segment) => [
    segment.name,
    `${formatNumber(segment.velocity, 4)} m/s`,
    formatNumber(segment.reynolds, 2),
    formatNumber(segment.frictionFactor, 5),
    `${formatNumber(segment.majorHeadLoss, 4)} m`
  ]);

  const fittingRows = (sideResult.fittingResults || []).map((fitting) => [
    `${fitting.name} (${fitting.count}x) @ ${fitting.segmentName}`,
    `${formatNumber(fitting.velocity, 4)} m/s`,
    '-',
    `Sigma K = ${formatNumber(fitting.subtotalK, 4)}`,
    `${formatNumber(fitting.headLoss, 4)} m`
  ]);

  const additionalRows = sideResult.additionalK > 0
    ? [[`Additional allowance @ ${sideResult.additionalKSegmentName}`, `${formatNumber(sideResult.referenceVelocity, 4)} m/s`, '-', `Sigma K = ${formatNumber(sideResult.additionalK, 4)}`, `${formatNumber(sideResult.additionalKHeadLoss, 4)} m`]]
    : [];

  const rows = segmentRows.concat(fittingRows).concat(additionalRows).concat([
    ['Total', '-', '-', `Sigma K = ${formatNumber(sideResult.totalSigmaK, 4)}`, `${formatNumber(sideResult.totalHeadLoss, 4)} m`]
  ]);

  container.innerHTML = renderTable(['Item', 'Velocity', 'Re', 'f / Sigma K', 'Head loss'], rows);
}

export function renderSystemCurveTable(container, curvePoints) {
  const rows = curvePoints.map((point) => [
    formatNumber(point.flowRate, 5),
    formatNumber(point.staticHead, 4),
    formatNumber(point.suctionLoss, 4),
    formatNumber(point.dischargeLoss, 4),
    formatNumber(point.totalHead, 4)
  ]);
  container.innerHTML = renderTable(['Q (m3/s)', 'Static (m)', 'Suction (m)', 'Discharge (m)', 'Total (m)'], rows);
}
