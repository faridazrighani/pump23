import { ATMOSPHERIC_PRESSURE } from '../core/units.js';

export const fluidPresets = [
  {
    id: 'water_25c',
    label: 'Water at 25 °C',
    density: 997,
    viscosity: 0.00089,
    temperature: 25,
    vaporPressure: 3169,
    sourcePressureAbs: ATMOSPHERIC_PRESSURE,
    destinationPressureAbs: ATMOSPHERIC_PRESSURE
  },
  {
    id: 'water_40c',
    label: 'Water at 40 °C',
    density: 992.2,
    viscosity: 0.000653,
    temperature: 40,
    vaporPressure: 7380,
    sourcePressureAbs: ATMOSPHERIC_PRESSURE,
    destinationPressureAbs: ATMOSPHERIC_PRESSURE
  },
  {
    id: 'methanol_25c',
    label: 'Methanol at 25 °C',
    density: 786.6,
    viscosity: 0.000544,
    temperature: 25,
    vaporPressure: 16900,
    sourcePressureAbs: ATMOSPHERIC_PRESSURE,
    destinationPressureAbs: ATMOSPHERIC_PRESSURE
  },
  {
    id: 'palm_oil_60c',
    label: 'Palm oil at 60 °C',
    density: 891,
    viscosity: 0.039,
    temperature: 60,
    vaporPressure: 100,
    sourcePressureAbs: ATMOSPHERIC_PRESSURE,
    destinationPressureAbs: ATMOSPHERIC_PRESSURE
  },
  {
    id: 'seawater_25c',
    label: 'Seawater at 25 °C',
    density: 1025,
    viscosity: 0.00096,
    temperature: 25,
    vaporPressure: 3169,
    sourcePressureAbs: ATMOSPHERIC_PRESSURE,
    destinationPressureAbs: ATMOSPHERIC_PRESSURE
  },
  {
    id: 'diesel_25c',
    label: 'Diesel at 25 °C',
    density: 832,
    viscosity: 0.003,
    temperature: 25,
    vaporPressure: 700,
    sourcePressureAbs: ATMOSPHERIC_PRESSURE,
    destinationPressureAbs: ATMOSPHERIC_PRESSURE
  }
];

export function getFluidPresetById(id) {
  return fluidPresets.find((item) => item.id === id) || fluidPresets[0];
}

export function resolvePresetVaporPressure(presetId, temperature) {
  const preset = getFluidPresetById(presetId);
  const toleranceC = 0.25;
  if (Math.abs((preset.temperature ?? 0) - (temperature ?? 0)) > toleranceC) {
    return null;
  }
  return preset.vaporPressure;
}
