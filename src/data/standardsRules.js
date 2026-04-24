export const standardsRules = {
  dutyFit: {
    flowErrorAcceptedMax: 0.10,
    flowErrorCautionMax: 0.20,
    headErrorAcceptedMax: 0.10,
    headErrorCautionMax: 0.20,
    note: 'Duty-fit thresholds are project defaults for screening and should be tightened when a project specification exists.'
  },
  npsh: {
    minMarginRejected: 0,
    minMarginCaution: 1.0,
    minRatioRejected: 1.0,
    minRatioCaution: 1.10,
    note: 'NPSH screening uses conservative project defaults and does not replace application-specific review against manufacturer-supplied NPSHR.'
  },
  operatingRegion: {
    porMin: 0.90,
    porMax: 1.10,
    aorMin: 0.80,
    aorMax: 1.20,
    note: 'POR/AOR bands are default screening bands around BEP. Vendor- or application-specific limits should override these defaults when available.'
  },
  power: {
    loadingAcceptedMax: 0.85,
    loadingCautionMax: 1.00,
    note: 'Motor loading check compares interpolated shaft/input power against the installed motor rating.'
  },
  viscosity: {
    uncorrectedWarningThresholdPaS: 0.01,
    note: 'Viscous-liquid cases that still use water-basis pump curves must be treated as preliminary until viscosity correction is applied.'
  }
};
