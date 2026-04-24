const WATER_DENSITY_KG_M3 = 997;
const SCREENING_THRESHOLD_CST = 10;

export function kinematicViscosityCst(viscosityPaS, densityKgM3) {
  if (!(viscosityPaS > 0) || !(densityKgM3 > 0)) return null;
  return (viscosityPaS / densityKgM3) * 1_000_000;
}

export function needsViscosityCorrection(viscosityPaS, densityKgM3 = WATER_DENSITY_KG_M3) {
  const cSt = kinematicViscosityCst(viscosityPaS, densityKgM3);
  return Number.isFinite(cSt) && cSt >= SCREENING_THRESHOLD_CST;
}

export function estimateViscosityCorrectionFactors(fluid) {
  const densityRatio = (fluid?.density > 0 ? fluid.density : WATER_DENSITY_KG_M3) / WATER_DENSITY_KG_M3;
  const cSt = kinematicViscosityCst(fluid?.viscosity, fluid?.density);

  if (!Number.isFinite(cSt) || cSt < SCREENING_THRESHOLD_CST) {
    return {
      applied: false,
      kinematicViscosityCst: cSt,
      flowFactor: 1,
      headFactor: 1,
      efficiencyFactor: 1,
      powerFactor: densityRatio,
      npshrFactor: 1
    };
  }

  const severity = Math.min(Math.log10(cSt / SCREENING_THRESHOLD_CST + 1), 1.6);
  const flowFactor = Math.max(0.86, 1 - (0.045 * severity));
  const headFactor = Math.max(0.82, 1 - (0.07 * severity));
  const efficiencyFactor = Math.max(0.62, 1 - (0.20 * severity));
  const npshrFactor = 1 + (0.07 * severity);
  const powerFactor = densityRatio * headFactor / efficiencyFactor;

  return {
    applied: true,
    kinematicViscosityCst: cSt,
    flowFactor,
    headFactor,
    efficiencyFactor,
    powerFactor,
    npshrFactor,
    note: 'Screening correction for viscous service; replace with vendor/ANSI-HI factors for final selection.'
  };
}

function scaleCurve(points, flowFactor, valueFactor) {
  return (points || []).map((point) => ({
    flowRate: point.flowRate * flowFactor,
    value: point.value * valueFactor
  }));
}

export function applyViscosityCorrection(candidate, fluid) {
  const factors = estimateViscosityCorrectionFactors(fluid);
  const isWaterBasis = (candidate?.curveBasis || 'unknown') === 'water';

  if (!factors.applied || !isWaterBasis) {
    return {
      ...candidate,
      curveAdjustments: {
        ...(candidate.curveAdjustments || {}),
        viscosity: {
          ...factors,
          applied: false,
          skippedReason: factors.applied ? 'Curve basis is not water.' : 'Fluid viscosity is below the correction threshold.'
        }
      }
    };
  }

  return {
    ...candidate,
    curveBasis: 'viscosity_corrected_screening',
    originalCurveBasis: candidate.curveBasis || 'water',
    curves: {
      head: scaleCurve(candidate.curves.head, factors.flowFactor, factors.headFactor),
      efficiency: scaleCurve(candidate.curves.efficiency, factors.flowFactor, factors.efficiencyFactor),
      power: scaleCurve(candidate.curves.power, factors.flowFactor, factors.powerFactor),
      npshr: scaleCurve(candidate.curves.npshr, factors.flowFactor, factors.npshrFactor)
    },
    curveAdjustments: {
      ...(candidate.curveAdjustments || {}),
      viscosity: factors
    }
  };
}
