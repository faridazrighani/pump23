function isFiniteNumber(value) {
  return Number.isFinite(value);
}

export function validatePositive(name, value, errors) {
  if (!(value > 0)) {
    errors.push(`${name} must be greater than zero.`);
  }
}

export function validateFinite(name, value, errors) {
  if (!isFiniteNumber(value)) {
    errors.push(`${name} must be a finite numeric value.`);
  }
}

export function validateNonNegative(name, value, errors) {
  if (!(value >= 0)) {
    errors.push(`${name} must be zero or greater.`);
  }
}

function validateBoundary(sideName, side, errors) {
  const mode = sideName === 'suction' ? side?.sourceType : side?.destinationType;
  const label = sideName === 'suction' ? 'source' : 'destination';
  const pressure = side?.boundary?.pressureAbs;
  const elevation = side?.boundary?.elevation;

  if (!mode) {
    errors.push(`${sideName} boundary mode is missing.`);
    return;
  }

  if (!['open_tank', 'pressurized_vessel', 'line'].includes(mode)) {
    errors.push(`${sideName} boundary mode is invalid.`);
  }

  validateFinite(`${sideName} ${label} elevation`, elevation, errors);

  if (mode === 'pressurized_vessel' || mode === 'line') {
    validatePositive(`${sideName} ${label} pressure`, pressure, errors);
  }

  if (mode === 'open_tank' && isFiniteNumber(pressure) && pressure < 0) {
    errors.push(`${sideName} ${label} pressure cannot be negative.`);
  }
}

function validateFlowBasis(model, errors) {
  const density = model.fluid?.density;
  const flowRate = model.design?.flowRate;
  const massFlowRate = model.design?.massFlowRate;
  const flowBasis = model.design?.flowBasis || 'flowRate';

  if (!(flowRate > 0) && !(massFlowRate > 0)) {
    errors.push('Provide either design flow rate or mass flow rate.');
    return;
  }

  if (flowBasis === 'flowRate') {
    if (!(flowRate > 0)) {
      errors.push('Flow basis is set to volumetric flow rate, but Q is missing or invalid.');
    }
    if (massFlowRate > 0 && density > 0) {
      const inferredMassFlowRate = density * flowRate;
      const relativeError = Math.abs(massFlowRate - inferredMassFlowRate) / inferredMassFlowRate;
      if (relativeError > 0.01) {
        errors.push('Mass flow rate is inconsistent with flow rate and density for the selected volumetric-flow basis.');
      }
    }
  }

  if (flowBasis === 'massFlowRate') {
    if (!(massFlowRate > 0)) {
      errors.push('Flow basis is set to mass flow rate, but ṁ is missing or invalid.');
    }
    if (flowRate > 0 && density > 0) {
      const inferredFlowRate = massFlowRate / density;
      const relativeError = Math.abs(flowRate - inferredFlowRate) / inferredFlowRate;
      if (relativeError > 0.01) {
        errors.push('Flow rate is inconsistent with mass flow rate and density for the selected mass-flow basis.');
      }
    }
  }
}

function validateFluidModel(model, errors) {
  validatePositive('Density', model.fluid?.density, errors);
  validatePositive('Dynamic viscosity', model.fluid?.viscosity, errors);
  validateFinite('Operating temperature', model.fluid?.temperature, errors);

  const vaporPressureMode = model.fluid?.vaporPressureMode || 'preset';
  const vaporPressure = model.fluid?.vaporPressure;
  if (vaporPressureMode === 'manual') {
    validateNonNegative('Manual vapor pressure', vaporPressure, errors);
  }
  if (vaporPressureMode === 'preset' && !isFiniteNumber(vaporPressure)) {
    errors.push('Preset vapor pressure could not be resolved from the selected fluid preset.');
  }
}

function validateSide(sideName, side, errors) {
  if (!side) {
    errors.push(`${sideName} section is missing.`);
    return;
  }

  validateBoundary(sideName, side, errors);

  if (!Array.isArray(side.segments) || side.segments.length === 0) {
    errors.push(`${sideName} must contain at least one segment.`);
  }

  side.segments?.forEach((segment, index) => {
    validatePositive(`${sideName} segment ${index + 1} diameter`, segment.diameter, errors);
    validatePositive(`${sideName} segment ${index + 1} length`, segment.length, errors);
    validateNonNegative(`${sideName} segment ${index + 1} roughness`, segment.roughness, errors);
  });

  side.fittings?.forEach((fitting, index) => {
    validateNonNegative(`${sideName} fitting ${index + 1} count`, fitting.count, errors);
    validateNonNegative(`${sideName} fitting ${index + 1} K`, fitting.k, errors);
    if (!Number.isInteger(fitting.segmentIndex) || fitting.segmentIndex < 0 || fitting.segmentIndex >= (side.segments?.length || 0)) {
      errors.push(`${sideName} fitting ${index + 1} must reference a valid segment index.`);
    }
  });

  const additionalKSegmentIndex = side.additionalKSegmentIndex ?? Math.max((side.segments?.length || 1) - 1, 0);
  if (!Number.isInteger(additionalKSegmentIndex) || additionalKSegmentIndex < 0 || additionalKSegmentIndex >= (side.segments?.length || 0)) {
    errors.push(`${sideName} additional ΣK must reference a valid segment index.`);
  }
}

function validatePumpCandidates(model, errors) {
  const candidates = model.pumpCandidates || [];
  candidates.forEach((candidate, index) => {
    const prefix = `Pump candidate ${index + 1}`;
    if (!candidate.model) {
      errors.push(`${prefix} model is missing.`);
    }
    if (!(candidate.speedRpm > 0)) {
      errors.push(`${prefix} speed RPM is missing or invalid.`);
    }

    const headCurve = candidate.curves?.head || [];
    if (headCurve.length < 2) {
      errors.push(`${prefix} must include at least two head-curve points.`);
    }

    ['head', 'efficiency', 'power', 'npshr'].forEach((curveName) => {
      const curve = candidate.curves?.[curveName] || [];
      let previousFlowRate = -Infinity;
      curve.forEach((point, pointIndex) => {
        if (!isFiniteNumber(point.flowRate) || !isFiniteNumber(point.value)) {
          errors.push(`${prefix} ${curveName} curve contains a non-numeric point at index ${pointIndex}.`);
          return;
        }
        if (point.flowRate < previousFlowRate) {
          errors.push(`${prefix} ${curveName} curve flow-rate points must be monotonically increasing.`);
        }
        if (point.flowRate === previousFlowRate) {
          errors.push(`${prefix} ${curveName} curve contains duplicate flow-rate points.`);
        }
        previousFlowRate = point.flowRate;
      });
    });

    if (!(candidate.motorPowerRated > 0)) {
      errors.push(`${prefix} motorPowerRated is missing or invalid.`);
    }
  });
}

export function validateCaseModel(model) {
  const errors = [];
  if (!model || typeof model !== 'object') {
    return ['Case model is missing.'];
  }

  validateFluidModel(model, errors);
  validateFlowBasis(model, errors);
  validateSide('suction', model.suction, errors);
  validateSide('discharge', model.discharge, errors);
  validatePumpCandidates(model, errors);

  return errors;
}
