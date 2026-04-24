import { areaFromDiameter } from './geometry.js';

export function resolveFlowRate(flowRate, massFlowRate, density, flowBasis = 'flowRate') {
  if (flowBasis === 'massFlowRate') {
    if (massFlowRate > 0 && density > 0) {
      return massFlowRate / density;
    }
    return flowRate > 0 ? flowRate : 0;
  }

  if (flowRate > 0) {
    return flowRate;
  }
  if (massFlowRate > 0 && density > 0) {
    return massFlowRate / density;
  }
  return 0;
}

export function resolveMassFlowRate(flowRate, massFlowRate, density, flowBasis = 'flowRate') {
  if (flowBasis === 'massFlowRate') {
    if (massFlowRate > 0) {
      return massFlowRate;
    }
    if (flowRate > 0 && density > 0) {
      return density * flowRate;
    }
    return 0;
  }

  if (flowRate > 0 && density > 0) {
    return density * flowRate;
  }
  if (massFlowRate > 0) {
    return massFlowRate;
  }
  return 0;
}

export function velocityFromFlowRate(flowRate, diameter) {
  const area = areaFromDiameter(diameter);
  return area > 0 ? flowRate / area : 0;
}

export function reynoldsNumber(density, velocity, diameter, viscosity) {
  if (!(viscosity > 0)) {
    return 0;
  }
  return (density * velocity * diameter) / viscosity;
}
