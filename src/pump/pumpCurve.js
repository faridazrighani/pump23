import { interpolateCurve } from '../core/interpolation.js';

function mapCurve(points) {
  return (points || []).slice().sort((a, b) => a.flowRate - b.flowRate).map((item) => ({ x: item.flowRate, y: item.value }));
}

export function getCurveRange(points) {
  if (!points || !points.length) {
    return { minFlowRate: null, maxFlowRate: null };
  }
  return {
    minFlowRate: points[0].flowRate,
    maxFlowRate: points[points.length - 1].flowRate
  };
}

export function isWithinRange(q, range) {
  return Number.isFinite(q) && Number.isFinite(range.minFlowRate) && Number.isFinite(range.maxFlowRate)
    ? q >= range.minFlowRate && q <= range.maxFlowRate
    : false;
}

function interpolateMetric(points, q) {
  const range = getCurveRange(points);
  if (!isWithinRange(q, range)) {
    return null;
  }
  return interpolateCurve(mapCurve(points), q);
}

export function buildPumpCurveFunctions(candidate) {
  return {
    headAtQ: (q) => interpolateMetric(candidate.curves.head, q),
    efficiencyAtQ: (q) => interpolateMetric(candidate.curves.efficiency, q),
    powerAtQ: (q) => interpolateMetric(candidate.curves.power, q),
    npshrAtQ: (q) => interpolateMetric(candidate.curves.npshr, q)
  };
}

export function getHeadCurveRange(candidate) {
  return getCurveRange(candidate?.curves?.head || []);
}

export function detectBep(candidate) {
  const curve = candidate.curves?.efficiency || [];
  if (!curve.length) return null;
  return curve.reduce((best, point) => (point.value > best.value ? point : best), curve[0]);
}

export function buildCurveSeries(candidate, samples = 32) {
  const headRange = getCurveRange(candidate.curves.head);
  const curves = buildPumpCurveFunctions(candidate);
  if (!Number.isFinite(headRange.minFlowRate) || !Number.isFinite(headRange.maxFlowRate)) {
    return { head: [], efficiency: [], power: [], npshr: [] };
  }
  const series = { head: [], efficiency: [], power: [], npshr: [] };
  for (let index = 0; index < samples; index += 1) {
    const q = headRange.minFlowRate + ((headRange.maxFlowRate - headRange.minFlowRate) * index) / Math.max(samples - 1, 1);
    const metrics = {
      head: curves.headAtQ(q),
      efficiency: curves.efficiencyAtQ(q),
      power: curves.powerAtQ(q),
      npshr: curves.npshrAtQ(q)
    };
    Object.entries(metrics).forEach(([key, value]) => {
      if (value !== null) {
        series[key].push({ flowRate: q, value });
      }
    });
  }
  return series;
}

export function summarizePumpCandidate(candidate, dutyFlowRate, dutyHead = null) {
  const curves = buildPumpCurveFunctions(candidate);
  const bep = detectBep(candidate);
  const headAtDuty = curves.headAtQ(dutyFlowRate);
  const efficiencyAtDuty = curves.efficiencyAtQ(dutyFlowRate);
  const powerAtDuty = curves.powerAtQ(dutyFlowRate);
  const npshrAtDuty = curves.npshrAtQ(dutyFlowRate);
  const headRange = getCurveRange(candidate.curves.head);
  const dutyInRange = isWithinRange(dutyFlowRate, headRange);
  return {
    ...candidate,
    dutyInRange,
    dutyFlowRate,
    headAtDuty,
    efficiencyAtDuty,
    powerAtDuty,
    npshrAtDuty,
    headMarginVsDuty: dutyHead === null || headAtDuty === null ? null : headAtDuty - dutyHead,
    bepFlowRate: bep?.flowRate ?? null,
    bepEfficiency: bep?.value ?? null,
    minFlowRate: headRange.minFlowRate,
    maxFlowRate: headRange.maxFlowRate,
    curveSeries: buildCurveSeries(candidate)
  };
}
