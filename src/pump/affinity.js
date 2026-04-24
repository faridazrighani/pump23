export function scaleBySpeed(baseValue, n1, n2, exponent) {
  if (!(n1 > 0) || !(n2 > 0)) return null;
  return baseValue * Math.pow(n2 / n1, exponent);
}

export function scaleByImpeller(baseValue, d1, d2, exponent) {
  if (!(d1 > 0) || !(d2 > 0)) return null;
  return baseValue * Math.pow(d2 / d1, exponent);
}

function scaleCurvePoints(points, flowFactor, valueFactor) {
  return (points || []).map((point) => ({
    flowRate: point.flowRate * flowFactor,
    value: point.value * valueFactor
  }));
}

function numberOrNull(value) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

export function resolveAffinityTargets(candidate) {
  const baseSpeedRpm = numberOrNull(candidate?.speedRpm);
  const baseImpellerDiameter = numberOrNull(candidate?.impellerDiameter);
  const requestedSpeedRpm = numberOrNull(candidate?.targetSpeedRpm ?? candidate?.adjustedSpeedRpm);
  const requestedImpellerDiameter = numberOrNull(candidate?.targetImpellerDiameter ?? candidate?.trimmedImpellerDiameter);
  const targetSpeedRpm = requestedSpeedRpm ?? baseSpeedRpm;
  const targetImpellerDiameter = requestedImpellerDiameter ?? baseImpellerDiameter;

  return {
    baseSpeedRpm,
    targetSpeedRpm,
    baseImpellerDiameter,
    targetImpellerDiameter,
    hasSpeedChange: Number.isFinite(baseSpeedRpm) && Number.isFinite(targetSpeedRpm) && Math.abs(targetSpeedRpm - baseSpeedRpm) > 1e-9,
    hasImpellerTrim: Number.isFinite(baseImpellerDiameter) && Number.isFinite(targetImpellerDiameter) && Math.abs(targetImpellerDiameter - baseImpellerDiameter) > 1e-12,
    requestedSpeedRpm,
    requestedImpellerDiameter
  };
}

export function applyAffinityTransform(candidate) {
  const targets = resolveAffinityTargets(candidate);
  const speedRatio = targets.hasSpeedChange ? targets.targetSpeedRpm / targets.baseSpeedRpm : 1;
  const diameterRatio = targets.hasImpellerTrim ? targets.targetImpellerDiameter / targets.baseImpellerDiameter : 1;

  if (targets.requestedSpeedRpm !== null && !(targets.baseSpeedRpm > 0)) {
    throw new Error(`${candidate.model || candidate.id}: base speedRpm is required for speed-change scaling.`);
  }
  if (targets.requestedImpellerDiameter !== null && !(targets.baseImpellerDiameter > 0)) {
    throw new Error(`${candidate.model || candidate.id}: base impellerDiameter is required for impeller-trim scaling.`);
  }

  if (!(speedRatio > 0) || !(diameterRatio > 0)) {
    throw new Error(`${candidate.model || candidate.id}: target speed and target impeller diameter must be greater than zero.`);
  }

  if (!targets.hasSpeedChange && !targets.hasImpellerTrim) {
    return {
      ...candidate,
      curveAdjustments: {
        ...(candidate.curveAdjustments || {}),
        affinity: {
          applied: false,
          speedRatio: 1,
          diameterRatio: 1
        }
      }
    };
  }

  const flowFactor = speedRatio * diameterRatio;
  const headFactor = Math.pow(speedRatio, 2) * Math.pow(diameterRatio, 2);
  const powerFactor = Math.pow(speedRatio, 3) * Math.pow(diameterRatio, 3);

  return {
    ...candidate,
    speedRpm: targets.targetSpeedRpm ?? candidate.speedRpm,
    impellerDiameter: targets.targetImpellerDiameter ?? candidate.impellerDiameter,
    baseSpeedRpm: targets.baseSpeedRpm,
    baseImpellerDiameter: targets.baseImpellerDiameter,
    curves: {
      head: scaleCurvePoints(candidate.curves.head, flowFactor, headFactor),
      efficiency: scaleCurvePoints(candidate.curves.efficiency, flowFactor, 1),
      power: scaleCurvePoints(candidate.curves.power, flowFactor, powerFactor),
      npshr: scaleCurvePoints(candidate.curves.npshr, flowFactor, Math.pow(speedRatio, 2))
    },
    curveAdjustments: {
      ...(candidate.curveAdjustments || {}),
      affinity: {
        applied: true,
        speedRatio,
        diameterRatio,
        flowFactor,
        headFactor,
        powerFactor,
        npshrFactor: Math.pow(speedRatio, 2)
      }
    }
  };
}
