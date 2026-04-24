import { bisectionSolve } from '../core/rootFinding.js';
import { safeDivide } from '../core/units.js';
import { standardsRules } from '../data/standardsRules.js';
import { computeHydraulicState, estimateSystemCurveMaxFlow } from '../hydraulics/systemCurve.js';
import { computeNpsha } from '../hydraulics/npsh.js';
import { buildPumpCurveFunctions, getHeadCurveRange, isWithinRange } from './pumpCurve.js';
import { classifyOperatingRegion } from './operatingRegion.js';

function resolveSearchDomain(model, candidate, explicitMaxFlow = null) {
  const range = getHeadCurveRange(candidate);
  const systemMaxFlow = explicitMaxFlow ?? estimateSystemCurveMaxFlow(model);
  const lowerFlowRate = Math.max(0, range.minFlowRate ?? 0);
  const upperFlowRate = Math.min(systemMaxFlow, range.maxFlowRate ?? 0);
  return {
    systemMaxFlow,
    lowerFlowRate,
    upperFlowRate,
    candidateMinFlowRate: range.minFlowRate,
    candidateMaxFlowRate: range.maxFlowRate
  };
}

function findBracket(diffFn, lowerFlowRate, upperFlowRate, samples = 160) {
  let previousQ = null;
  let previousValue = null;
  let closest = null;

  for (let index = 0; index <= samples; index += 1) {
    const ratio = index / Math.max(samples, 1);
    const q = lowerFlowRate + ((upperFlowRate - lowerFlowRate) * ratio);
    const value = diffFn(q);
    if (!Number.isFinite(value)) {
      continue;
    }

    const magnitude = Math.abs(value);
    if (!closest || magnitude < closest.absDiff) {
      closest = {
        flowRate: q,
        diff: value,
        absDiff: magnitude
      };
    }

    if (Math.abs(value) < 1e-10) {
      return {
        lowerFlowRate: q,
        upperFlowRate: q,
        exact: true,
        closest
      };
    }

    if (previousValue !== null && previousValue * value < 0) {
      return {
        lowerFlowRate: previousQ,
        upperFlowRate: q,
        exact: false,
        closest
      };
    }

    previousQ = q;
    previousValue = value;
  }

  return {
    lowerFlowRate: null,
    upperFlowRate: null,
    exact: false,
    closest
  };
}

export function solveOperatingPoint(model, candidate, options = {}) {
  const curves = buildPumpCurveFunctions(candidate);
  const domain = resolveSearchDomain(model, candidate, options.systemMaxFlow ?? null);

  if (!(domain.upperFlowRate > domain.lowerFlowRate)) {
    return {
      candidateId: candidate.id,
      model: candidate.model,
      vendor: candidate.vendor,
      status: 'no_overlap_domain',
      statusLabel: 'No common flow range',
      ...domain
    };
  }

  const systemHeadFn = (q) => computeHydraulicState(model, q).totalHead;
  const pumpHeadFn = (q) => curves.headAtQ(q);
  const diffFn = (q) => {
    const pumpHead = pumpHeadFn(q);
    if (!Number.isFinite(pumpHead)) {
      return NaN;
    }
    return pumpHead - systemHeadFn(q);
  };

  const diffAtLower = diffFn(domain.lowerFlowRate);
  const diffAtUpper = diffFn(domain.upperFlowRate);
  const bracket = findBracket(diffFn, domain.lowerFlowRate, domain.upperFlowRate, options.samples ?? 180);

  if (!Number.isFinite(diffAtLower) || !Number.isFinite(diffAtUpper)) {
    return {
      candidateId: candidate.id,
      model: candidate.model,
      vendor: candidate.vendor,
      status: 'invalid_domain_evaluation',
      statusLabel: 'Invalid curve/domain input',
      diffAtLower,
      diffAtUpper,
      ...domain,
      closestSample: bracket.closest || null
    };
  }

  if (!Number.isFinite(bracket.lowerFlowRate) || !Number.isFinite(bracket.upperFlowRate)) {
    const closestFlowRate = bracket.closest?.flowRate ?? null;
    const closestState = Number.isFinite(closestFlowRate) ? computeHydraulicState(model, closestFlowRate) : null;
    const closestPumpHead = Number.isFinite(closestFlowRate) ? pumpHeadFn(closestFlowRate) : null;
    return {
      candidateId: candidate.id,
      model: candidate.model,
      vendor: candidate.vendor,
      status: 'no_intersection_in_domain',
      statusLabel: 'No operating point in common range',
      diffAtLower,
      diffAtUpper,
      ...domain,
      closestSample: bracket.closest || null,
      closestFlowRate,
      closestSystemHead: closestState?.totalHead ?? null,
      closestPumpHead,
      closestHeadDifference: bracket.closest?.diff ?? null
    };
  }

  const solvedFlowRate = bracket.exact
    ? bracket.lowerFlowRate
    : bisectionSolve(diffFn, bracket.lowerFlowRate, bracket.upperFlowRate, options.tolerance ?? 1e-8, options.maxIterations ?? 100);

  if (!Number.isFinite(solvedFlowRate)) {
    return {
      candidateId: candidate.id,
      model: candidate.model,
      vendor: candidate.vendor,
      status: 'root_solver_failed',
      statusLabel: 'Numerical solve failed',
      diffAtLower,
      diffAtUpper,
      bracketLowerFlowRate: bracket.lowerFlowRate,
      bracketUpperFlowRate: bracket.upperFlowRate,
      ...domain,
      closestSample: bracket.closest || null
    };
  }

  const hydraulicState = computeHydraulicState(model, solvedFlowRate);
  const operatingHead = pumpHeadFn(solvedFlowRate);
  const efficiencyAtOperatingPoint = curves.efficiencyAtQ(solvedFlowRate);
  const powerAtOperatingPoint = curves.powerAtQ(solvedFlowRate);
  const npshrAtOperatingPoint = curves.npshrAtQ(solvedFlowRate);
  const npshaAtOperatingPoint = computeNpsha(model, hydraulicState);
  const headResidual = operatingHead - hydraulicState.totalHead;

  return {
    candidateId: candidate.id,
    model: candidate.model,
    vendor: candidate.vendor,
    status: 'solved',
    statusLabel: 'Solved',
    ...domain,
    bracketLowerFlowRate: bracket.lowerFlowRate,
    bracketUpperFlowRate: bracket.upperFlowRate,
    diffAtLower,
    diffAtUpper,
    flowRate: solvedFlowRate,
    systemHead: hydraulicState.totalHead,
    pumpHead: operatingHead,
    headResidual,
    staticHead: hydraulicState.staticHead,
    suctionLoss: hydraulicState.suction.totalHeadLoss,
    dischargeLoss: hydraulicState.discharge.totalHeadLoss,
    efficiency: efficiencyAtOperatingPoint,
    power: powerAtOperatingPoint,
    npshr: npshrAtOperatingPoint,
    npsha: npshaAtOperatingPoint,
    npshMargin: Number.isFinite(npshaAtOperatingPoint) && Number.isFinite(npshrAtOperatingPoint)
      ? npshaAtOperatingPoint - npshrAtOperatingPoint
      : null,
    inHeadCurveRange: isWithinRange(solvedFlowRate, getHeadCurveRange(candidate))
  };
}

export function solveOperatingPointsForCandidates(model, candidates, options = {}) {
  return (candidates || []).map((candidate) => solveOperatingPoint(model, candidate, options));
}

function findSummaryForCandidate(summaries, candidateId, modelName) {
  return (summaries || []).find((item) => item.id === candidateId || item.model === modelName) || null;
}

function findCandidateById(candidates, candidateId, modelName) {
  return (candidates || []).find((item) => item.id === candidateId || item.model === modelName) || null;
}

function evaluateDutyFit(summary, operatingPoint, dutyHead) {
  const flowError = Number.isFinite(operatingPoint?.flowRate) && Number.isFinite(summary?.dutyFlowRate)
    ? Math.abs(operatingPoint.flowRate - summary.dutyFlowRate) / Math.max(summary.dutyFlowRate, 1e-12)
    : null;
  const headError = Number.isFinite(operatingPoint?.systemHead) && Number.isFinite(dutyHead)
    ? Math.abs(operatingPoint.systemHead - dutyHead) / Math.max(dutyHead, 1e-12)
    : null;

  let status = 'unknown';
  let label = 'Duty fit unknown';

  if (flowError === null || headError === null) {
    return { flowError, headError, status, label };
  }

  const flowRules = standardsRules.dutyFit;
  if (flowError <= flowRules.flowErrorAcceptedMax && headError <= flowRules.headErrorAcceptedMax) {
    status = 'accepted';
    label = 'Duty fit acceptable';
  } else if (flowError <= flowRules.flowErrorCautionMax && headError <= flowRules.headErrorCautionMax) {
    status = 'caution';
    label = 'Duty fit marginal';
  } else {
    status = 'rejected';
    label = 'Duty fit unacceptable';
  }

  return { flowError, headError, status, label };
}

function evaluateNpsh(operatingPoint) {
  const npshMargin = operatingPoint?.npshMargin;
  const npshRatio = Number.isFinite(operatingPoint?.npsha) && Number.isFinite(operatingPoint?.npshr)
    ? safeDivide(operatingPoint.npsha, operatingPoint.npshr, null)
    : null;

  if (!Number.isFinite(npshMargin) || !Number.isFinite(npshRatio)) {
    return {
      status: 'unknown',
      label: 'NPSH check unknown',
      npshRatio,
      npshMargin
    };
  }

  const rules = standardsRules.npsh;
  if (npshMargin < rules.minMarginRejected || npshRatio < rules.minRatioRejected) {
    return { status: 'rejected', label: 'NPSH insufficient', npshRatio, npshMargin };
  }
  if (npshMargin < rules.minMarginCaution || npshRatio < rules.minRatioCaution) {
    return { status: 'caution', label: 'NPSH margin low', npshRatio, npshMargin };
  }
  return { status: 'accepted', label: 'NPSH acceptable', npshRatio, npshMargin };
}

function evaluatePower(candidate, operatingPoint) {
  const powerAtOp = operatingPoint?.power;
  const rated = candidate?.motorPowerRated;
  const loading = Number.isFinite(powerAtOp) && Number.isFinite(rated) ? safeDivide(powerAtOp, rated, null) : null;

  if (!Number.isFinite(loading)) {
    return { status: 'unknown', label: 'Motor loading unknown', loading };
  }

  const rules = standardsRules.power;
  if (loading > rules.loadingCautionMax) {
    return { status: 'rejected', label: 'Motor overload risk', loading };
  }
  if (loading > rules.loadingAcceptedMax) {
    return { status: 'caution', label: 'Motor loading high', loading };
  }
  return { status: 'accepted', label: 'Motor loading acceptable', loading };
}

function evaluateViscosityWarning(model, candidate) {
  const mu = model?.fluid?.viscosity;
  const threshold = standardsRules.viscosity.uncorrectedWarningThresholdPaS;
  const viscosityAdjustment = candidate?.curveAdjustments?.viscosity;
  const isCorrected = Boolean(viscosityAdjustment?.applied);
  const isUncorrectedViscousCase = Number.isFinite(mu) && mu >= threshold && (candidate?.curveBasis || 'unknown') === 'water' && !isCorrected;
  return {
    isUncorrectedViscousCase,
    isCorrected,
    status: isUncorrectedViscousCase ? 'caution' : 'accepted',
    label: isUncorrectedViscousCase ? 'Viscosity correction pending' : (isCorrected ? 'Viscosity correction applied' : 'Curve basis aligned for screening'),
    note: isUncorrectedViscousCase
      ? 'Preliminary only: viscous liquid is still using water-basis pump curves because Tahap F viscosity correction has not yet been applied.'
      : (isCorrected ? viscosityAdjustment.note : null)
  };
}

function statusRank(status) {
  if (status === 'rejected') return 3;
  if (status === 'caution') return 2;
  if (status === 'unknown') return 1;
  return 0;
}

function buildDecisionSummary(overallStatus, viscosityFlag) {
  if (overallStatus === 'rejected') {
    return {
      decision: 'rejected',
      label: 'Rejected',
      badgeClass: 'badge-rejected'
    };
  }

  if (overallStatus === 'caution' || viscosityFlag) {
    return {
      decision: 'accepted_with_caution',
      label: viscosityFlag ? 'Preliminary / caution' : 'Accepted with caution',
      badgeClass: 'badge-caution'
    };
  }

  return {
    decision: 'accepted',
    label: 'Accepted',
    badgeClass: 'badge-accepted'
  };
}

function buildReasonList(checks, operatingRegion, viscosityCheck, operatingPoint) {
  const reasons = [];

  if (operatingPoint.status !== 'solved') {
    reasons.push(operatingPoint.statusLabel || 'Operating point could not be solved.');
    return reasons;
  }

  Object.values(checks).forEach((check) => {
    if (check?.status === 'rejected' || check?.status === 'caution') {
      reasons.push(check.label);
    }
  });

  if (operatingRegion?.status === 'aor' || operatingRegion?.status === 'outside_aor' || operatingRegion?.status === 'unknown') {
    reasons.push(operatingRegion.label);
  }

  if (viscosityCheck?.isUncorrectedViscousCase && viscosityCheck.note) {
    reasons.push('Preliminary only: viscosity correction pending');
  }

  if (!reasons.length) {
    reasons.push('All screening checks passed within the current default rules.');
  }

  return reasons;
}

function computeScore(checks, operatingRegion, viscosityCheck, operatingPoint) {
  if (operatingPoint.status !== 'solved') return 0;

  let score = 100;
  const dutyFit = checks.dutyFit;
  const flowPenalty = Number.isFinite(dutyFit.flowError) ? Math.min(dutyFit.flowError * 220, 40) : 18;
  const headPenalty = Number.isFinite(dutyFit.headError) ? Math.min(dutyFit.headError * 180, 30) : 12;
  score -= flowPenalty + headPenalty;

  if (checks.npsh.status === 'caution') score -= 10;
  if (checks.npsh.status === 'rejected') score -= 35;

  if (checks.power.status === 'caution') score -= 8;
  if (checks.power.status === 'rejected') score -= 30;

  if (operatingRegion.status === 'aor') score -= 8;
  if (operatingRegion.status === 'outside_aor') score -= 18;
  if (operatingRegion.status === 'unknown') score -= 6;

  if (viscosityCheck.isUncorrectedViscousCase) score -= 12;

  return Math.max(0, Math.min(100, Math.round(score)));
}

export function evaluateDecisionForCandidate(model, summary, operatingPoint, dutyHead) {
  const candidate = findCandidateById(model?.pumpCandidates || [], operatingPoint?.candidateId, operatingPoint?.model);

  if (!summary || !candidate || !operatingPoint) {
    return {
      candidateId: operatingPoint?.candidateId ?? summary?.id ?? candidate?.id ?? null,
      model: operatingPoint?.model ?? summary?.model ?? candidate?.model ?? 'Unknown candidate',
      decision: 'rejected',
      label: 'Rejected',
      badgeClass: 'badge-rejected',
      score: 0,
      operatingRegion: { status: 'unknown', label: 'Region unknown', ratioToBep: null },
      dutyFit: { status: 'unknown', label: 'Duty fit unknown', flowError: null, headError: null },
      npshCheck: { status: 'unknown', label: 'NPSH check unknown', npshRatio: null, npshMargin: null },
      powerCheck: { status: 'unknown', label: 'Motor loading unknown', loading: null },
      viscosityCheck: { isUncorrectedViscousCase: false, label: 'Curve basis unknown', note: null },
      reasons: ['Selection inputs are incomplete for this candidate.']
    };
  }

  if (operatingPoint.status !== 'solved') {
    return {
      candidateId: candidate.id,
      model: candidate.model,
      vendor: candidate.vendor,
      curveBasis: candidate.curveBasis || 'unknown',
      decision: 'rejected',
      label: 'Rejected',
      badgeClass: 'badge-rejected',
      score: 0,
      operatingRegion: { status: 'unknown', label: 'Region unknown', ratioToBep: null },
      dutyFit: { status: 'rejected', label: operatingPoint.statusLabel || 'Operating point not solved', flowError: null, headError: null },
      npshCheck: { status: 'unknown', label: 'NPSH check unknown', npshRatio: null, npshMargin: null },
      powerCheck: { status: 'unknown', label: 'Motor loading unknown', loading: null },
      viscosityCheck: evaluateViscosityWarning(model, candidate),
      reasons: [operatingPoint.statusLabel || 'Operating point could not be solved for this candidate.']
    };
  }

  const dutyFit = evaluateDutyFit(summary, operatingPoint, dutyHead);
  const npshCheck = evaluateNpsh(operatingPoint);
  const powerCheck = evaluatePower(candidate, operatingPoint);
  const operatingRegion = classifyOperatingRegion(operatingPoint.flowRate, summary.bepFlowRate);
  const viscosityCheck = evaluateViscosityWarning(model, candidate);

  const checks = { dutyFit, npsh: npshCheck, power: powerCheck };
  const statuses = [
    dutyFit.status,
    npshCheck.status,
    powerCheck.status,
    operatingRegion.status === 'por' ? 'accepted' : 'caution',
    viscosityCheck.status
  ];
  const overallStatus = statuses.reduce((worst, status) => (statusRank(status) > statusRank(worst) ? status : worst), 'accepted');
  const decisionSummary = buildDecisionSummary(overallStatus, viscosityCheck.isUncorrectedViscousCase && overallStatus !== 'rejected');
  const score = computeScore(checks, operatingRegion, viscosityCheck, operatingPoint);
  const reasons = buildReasonList(checks, operatingRegion, viscosityCheck, operatingPoint);

  return {
    candidateId: candidate.id,
    model: candidate.model,
    vendor: candidate.vendor,
    curveBasis: candidate.curveBasis || 'unknown',
    decision: decisionSummary.decision,
    label: decisionSummary.label,
    badgeClass: decisionSummary.badgeClass,
    score,
    operatingRegion,
    dutyFit,
    npshCheck,
    powerCheck,
    viscosityCheck,
    reasons
  };
}

export function evaluateDecisionForCandidates(model, summaries, operatingPoints, dutyHead) {
  return (operatingPoints || []).map((operatingPoint) => {
    const summary = findSummaryForCandidate(summaries, operatingPoint.candidateId, operatingPoint.model);
    return evaluateDecisionForCandidate(model, summary, operatingPoint, dutyHead);
  }).sort((a, b) => b.score - a.score);
}

export function selectionScaffold() {
  return {
    status: 'retired',
    note: 'Decision engine is now active for screening-level pump selection.'
  };
}
