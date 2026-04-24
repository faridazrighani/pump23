import { safeDivide } from '../core/units.js';

export function areaFromDiameter(diameter) {
  return (Math.PI * diameter * diameter) / 4;
}

export function relativeRoughness(roughness, diameter) {
  return safeDivide(roughness, diameter, 0);
}
