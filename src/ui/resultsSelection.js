import { formatNumber } from '../core/units.js';

function renderTable(headers, rows) {
  const headMarkup = headers.map((item) => `<th>${item}</th>`).join('');
  const rowMarkup = rows.map((row) => `<tr>${row.map((cell) => `<td>${cell}</td>`).join('')}</tr>`).join('');
  return `<div class="table-scroll"><table><thead><tr>${headMarkup}</tr></thead><tbody>${rowMarkup}</tbody></table></div>`;
}

function lookupOperatingPoint(summary, operatingPoints) {
  return (operatingPoints || []).find((item) => item.candidateId === summary.id || item.model === summary.model) || null;
}

function lookupDecision(summary, decisions) {
  return (decisions || []).find((item) => item.candidateId === summary.id || item.model === summary.model) || null;
}

function formatOperatingPointCell(op, key, suffix = '', digits = 4) {
  if (!op || op.status !== 'solved' || !Number.isFinite(op[key])) {
    return '-';
  }
  return `${formatNumber(op[key], digits)}${suffix}`;
}

function formatPercent(value, digits = 1) {
  if (!Number.isFinite(value)) return '-';
  return `${formatNumber(value * 100, digits)} %`;
}

function formatRatio(value, digits = 3) {
  if (!Number.isFinite(value)) return '-';
  return formatNumber(value, digits);
}

function buildBadge(label, badgeClass) {
  return `<span class="status-badge ${badgeClass || ''}">${label}</span>`;
}

function buildReasonMarkup(decision) {
  if (!decision?.reasons?.length) return '-';
  return `<ul class="mini-list">${decision.reasons.map((item) => `<li>${item}</li>`).join('')}</ul>`;
}

function buildAdjustmentMarkup(summary, decision) {
  const affinity = summary.curveAdjustments?.affinity;
  const viscosity = summary.curveAdjustments?.viscosity;
  const lines = [decision?.curveBasis || summary.curveBasis || 'unknown'];

  if (affinity?.applied) {
    lines.push(`<span class="subtle-inline">Speed ${formatRatio(affinity.speedRatio, 3)}x, trim ${formatRatio(affinity.diameterRatio, 3)}x</span>`);
  }

  if (viscosity?.applied) {
    lines.push(`<span class="warning-inline">Visc corrected (${formatNumber(viscosity.kinematicViscosityCst, 1)} cSt)</span>`);
  } else if (decision?.viscosityCheck?.isUncorrectedViscousCase) {
    lines.push('<span class="warning-inline">Viscosity correction pending</span>');
  }

  return lines.join('<br>');
}

export function renderPumpCurveSummary(container, summaries, dutyHead, operatingPoints = [], decisions = []) {
  if (!summaries.length) {
    container.innerHTML = '<div class="note-box">No pump candidates loaded yet. Load the sample case or paste pump-candidate JSON to activate Tahap C/Tahap D/Tahap E.</div>';
    return;
  }

  const rows = summaries.map((summary) => {
    const op = lookupOperatingPoint(summary, operatingPoints);
    const decision = lookupDecision(summary, decisions);
    const operatingResidual = op?.status === 'solved' && Number.isFinite(op.headResidual)
      ? `${formatNumber(Math.abs(op.headResidual), 6)} m`
      : (Number.isFinite(op?.closestHeadDifference) ? `${formatNumber(Math.abs(op.closestHeadDifference), 4)} m` : '-');

    const decisionBadge = decision
      ? `${buildBadge(decision.label, decision.badgeClass)}<div class="decision-score">Score: <strong>${decision.score}</strong>/100</div>`
      : '-';

    const dutyErrorMarkup = decision?.dutyFit
      ? `Qerr ${formatPercent(decision.dutyFit.flowError, 1)}<br>Herr ${formatPercent(decision.dutyFit.headError, 1)}`
      : '-';

    const regionMarkup = decision?.operatingRegion
      ? `${decision.operatingRegion.label}<br><span class="subtle-inline">Qop/BEP = ${formatRatio(decision.operatingRegion.ratioToBep, 3)}</span>`
      : '-';

    return [
      `${summary.vendor} - <strong>${summary.model}</strong>`,
      `${formatNumber(summary.minFlowRate, 4)} to ${formatNumber(summary.maxFlowRate, 4)}`,
      summary.headAtDuty === null ? 'Out of range' : `${formatNumber(summary.headAtDuty, 3)} m`,
      summary.headMarginVsDuty === null ? '-' : `${formatNumber(summary.headMarginVsDuty, 3)} m`,
      op?.statusLabel || 'Not solved',
      formatOperatingPointCell(op, 'flowRate', ' m3/s'),
      formatOperatingPointCell(op, 'pumpHead', ' m'),
      regionMarkup,
      dutyErrorMarkup,
      `${formatOperatingPointCell(op, 'npsha', ' m')}<br>${formatOperatingPointCell(op, 'npshr', ' m')}<br><span class="subtle-inline">dNPSH = ${formatOperatingPointCell(op, 'npshMargin', ' m')}</span>`,
      decision?.powerCheck ? `${formatOperatingPointCell(op, 'power', ' kW', 3)}<br><span class="subtle-inline">Load = ${formatPercent(decision.powerCheck.loading, 1)}</span>` : formatOperatingPointCell(op, 'power', ' kW', 3),
      buildAdjustmentMarkup(summary, decision),
      decisionBadge,
      buildReasonMarkup(decision),
      operatingResidual
    ];
  });

  const solvedCount = operatingPoints.filter((item) => item.status === 'solved').length;
  const acceptedCount = decisions.filter((item) => item.decision === 'accepted').length;
  const cautionCount = decisions.filter((item) => item.decision === 'accepted_with_caution').length;
  const rejectedCount = decisions.filter((item) => item.decision === 'rejected').length;
  const note = `<div class="note-box">Tahap E active. Duty-system head reference is <strong>${formatNumber(dutyHead, 4)} m</strong>. Operating-point solver solved <strong>${solvedCount}</strong> of <strong>${summaries.length}</strong> candidate(s). Screening decisions: <strong>${acceptedCount}</strong> accepted, <strong>${cautionCount}</strong> caution/preliminary, and <strong>${rejectedCount}</strong> rejected.</div>`;
  container.innerHTML = note + renderTable(
    ['Pump candidate', 'Q range (m3/s)', 'Head @ duty', 'Head - Hsystem', 'Operating status', 'Qop', 'Head @ op', 'Operating region', 'Duty mismatch', 'NPSH @ op', 'Power @ op', 'Curve basis / adjustments', 'Decision', 'Key reasons', '|dH| @ op'],
    rows
  );
}
