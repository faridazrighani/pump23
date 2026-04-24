import { applyAffinityTransform } from './affinity.js';
import { applyViscosityCorrection } from './viscosityCorrection.js';

function toNumericPoint(point) {
  if (!point || typeof point !== 'object') {
    return null;
  }
  const flowRate = Number(point.flowRate ?? point.q ?? point.x);
  const value = Number(point.value ?? point.head ?? point.efficiency ?? point.power ?? point.npshr ?? point.y);
  if (!Number.isFinite(flowRate) || !Number.isFinite(value)) {
    return null;
  }
  return { flowRate, value };
}

function normalizeCurve(points) {
  if (!Array.isArray(points)) {
    return [];
  }
  return points
    .map(toNumericPoint)
    .filter(Boolean)
    .sort((a, b) => a.flowRate - b.flowRate);
}

function assertCurveMonotonic(curve, candidateName, curveName) {
  let previousFlowRate = -Infinity;
  curve.forEach((point) => {
    if (point.flowRate <= previousFlowRate) {
      throw new Error(`${candidateName}: ${curveName} curve must be strictly increasing in flow rate.`);
    }
    previousFlowRate = point.flowRate;
  });
}

export function normalizePumpCandidates(rawCandidates) {
  if (!Array.isArray(rawCandidates)) {
    return [];
  }

  return rawCandidates.map((candidate, index) => {
    const model = candidate.model || `Candidate ${index + 1}`;
    const normalized = {
      id: candidate.id || `pump-${index + 1}`,
      vendor: candidate.vendor || 'Unknown vendor',
      model,
      speedRpm: Number(candidate.speedRpm ?? candidate.speedRPM) || null,
      impellerDiameter: Number(candidate.impellerDiameter) || null,
      targetSpeedRpm: Number(candidate.targetSpeedRpm ?? candidate.adjustedSpeedRpm) || null,
      targetImpellerDiameter: Number(candidate.targetImpellerDiameter ?? candidate.trimmedImpellerDiameter) || null,
      motorPowerRated: Number(candidate.motorPowerRated) || null,
      curveBasis: candidate.curveBasis || 'unknown',
      curves: {
        head: normalizeCurve(candidate.curves?.head || candidate.headCurve),
        efficiency: normalizeCurve(candidate.curves?.efficiency || candidate.efficiencyCurve),
        power: normalizeCurve(candidate.curves?.power || candidate.powerCurve),
        npshr: normalizeCurve(candidate.curves?.npshr || candidate.npshrCurve)
      }
    };

    if (!(normalized.speedRpm > 0)) {
      throw new Error(`${model}: speedRpm is required and must be greater than zero.`);
    }
    if (!(normalized.motorPowerRated > 0)) {
      throw new Error(`${model}: motorPowerRated is required and must be greater than zero.`);
    }
    if (normalized.curves.head.length < 2) {
      throw new Error(`${model}: at least two head-curve points are required.`);
    }

    ['head', 'efficiency', 'power', 'npshr'].forEach((curveName) => {
      const curve = normalized.curves[curveName];
      if (curve.length) {
        assertCurveMonotonic(curve, model, curveName);
      }
    });

    return normalized;
  });
}

export function preparePumpCandidatesForCase(rawCandidates, fluid) {
  return normalizePumpCandidates(rawCandidates)
    .map((candidate) => applyAffinityTransform(candidate))
    .map((candidate) => applyViscosityCorrection(candidate, fluid));
}
