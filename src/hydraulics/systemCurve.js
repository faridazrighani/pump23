import { ATMOSPHERIC_PRESSURE, GRAVITY } from '../core/units.js';
import { resolveFlowRate, resolveMassFlowRate } from './flow.js';
import { evaluateSide } from './losses.js';
import { validateCaseModel } from '../core/validators.js';

function resolveBoundaryPressure(mode, pressureAbs) {
  if (mode === 'open_tank') {
    return ATMOSPHERIC_PRESSURE;
  }
  return pressureAbs;
}

export function computeStaticHead(model) {
  const rho = model.fluid.density;
  const suctionMode = model.suction.sourceType;
  const dischargeMode = model.discharge.destinationType;
  const suctionPressure = resolveBoundaryPressure(suctionMode, model.suction.boundary.pressureAbs);
  const dischargePressure = resolveBoundaryPressure(dischargeMode, model.discharge.boundary.pressureAbs);
  const suctionElevation = model.suction.boundary.elevation;
  const dischargeElevation = model.discharge.boundary.elevation;
  return (dischargeElevation - suctionElevation) + ((dischargePressure - suctionPressure) / (rho * GRAVITY));
}

export function computeHydraulicState(model, trialFlowRate = null) {
  const errors = validateCaseModel(model);
  if (errors.length) {
    throw new Error(errors.join(' '));
  }

  const flowBasis = model.design.flowBasis || 'flowRate';
  const baseFlowRate = resolveFlowRate(model.design.flowRate, model.design.massFlowRate, model.fluid.density, flowBasis);
  const resolvedFlowRate = trialFlowRate !== null ? trialFlowRate : baseFlowRate;
  const massFlowRate = resolveMassFlowRate(resolvedFlowRate, model.design.massFlowRate, model.fluid.density, flowBasis);
  const suction = evaluateSide(resolvedFlowRate, model.fluid.density, model.fluid.viscosity, model.suction);
  const discharge = evaluateSide(resolvedFlowRate, model.fluid.density, model.fluid.viscosity, model.discharge);
  const staticHead = computeStaticHead(model);
  const totalHead = staticHead + suction.totalHeadLoss + discharge.totalHeadLoss;

  return {
    flowRate: resolvedFlowRate,
    massFlowRate,
    suction,
    discharge,
    staticHead,
    totalHead
  };
}

export function estimateSystemCurveMaxFlow(model) {
  const designFlow = resolveFlowRate(model.design.flowRate, model.design.massFlowRate, model.fluid.density, model.design.flowBasis || 'flowRate');
  const candidateMaxFlows = (model.pumpCandidates || [])
    .flatMap((candidate) => candidate.curves?.head || [])
    .map((point) => point.flowRate)
    .filter((value) => value > 0);
  const pumpCurveMax = candidateMaxFlows.length ? Math.max(...candidateMaxFlows) : 0;
  const fallback = designFlow > 0 ? designFlow * 1.5 : 0.05;
  return Math.max(fallback, pumpCurveMax);
}

export function computeSystemCurve(model, points = 31, minFlow = 0, maxFlow = null) {
  const qMax = maxFlow ?? estimateSystemCurveMaxFlow(model);
  const curve = [];
  for (let index = 0; index < points; index += 1) {
    const ratio = index / Math.max(points - 1, 1);
    const trialFlowRate = minFlow + ((qMax - minFlow) * ratio);
    const state = computeHydraulicState(model, trialFlowRate);
    curve.push({
      factor: qMax > 0 ? trialFlowRate / qMax : 0,
      flowRate: trialFlowRate,
      totalHead: state.totalHead,
      suctionLoss: state.suction.totalHeadLoss,
      dischargeLoss: state.discharge.totalHeadLoss,
      staticHead: state.staticHead
    });
  }
  return curve;
}
