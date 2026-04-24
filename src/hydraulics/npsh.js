import { ATMOSPHERIC_PRESSURE, GRAVITY } from '../core/units.js';
import { resolvePresetVaporPressure } from '../data/fluids.js';

export function resolveVaporPressure(model) {
  const mode = model.fluid?.vaporPressureMode || 'preset';
  if (mode === 'manual') {
    return model.fluid?.vaporPressure || 0;
  }
  return resolvePresetVaporPressure(model.fluid?.presetId, model.fluid?.temperature);
}

export function computeNpsha(model, hydraulicState) {
  const rho = model.fluid.density;
  const pv = resolveVaporPressure(model) || 0;
  const sourceType = model.suction.sourceType;
  const sourcePressureAbs = model.suction.boundary.pressureAbs || ATMOSPHERIC_PRESSURE;
  const sourceElevation = model.suction.boundary.elevation || 0;
  const pumpElevation = model.pump?.elevation || 0;
  const suctionLoss = hydraulicState.suction.totalHeadLoss;
  const suctionVelocityHead = (hydraulicState.suction.referenceVelocity ** 2) / (2 * GRAVITY);

  if (sourceType === 'open_tank') {
    return (ATMOSPHERIC_PRESSURE / (rho * GRAVITY)) + sourceElevation - pumpElevation - suctionLoss - (pv / (rho * GRAVITY));
  }

  if (sourceType === 'pressurized_vessel') {
    return (sourcePressureAbs / (rho * GRAVITY)) + sourceElevation - pumpElevation - suctionLoss - (pv / (rho * GRAVITY));
  }

  return (sourcePressureAbs / (rho * GRAVITY)) + sourceElevation - pumpElevation - suctionLoss + suctionVelocityHead - (pv / (rho * GRAVITY));
}
