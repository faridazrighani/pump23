import { ATMOSPHERIC_PRESSURE } from '../core/units.js';
import { getFluidPresetById } from './fluids.js';
import { getMaterialPresetById } from './materials.js';
import { fittingCatalog } from './fittings.js';

function buildDefaultPumpCandidates() {
  return [
    {
      id: 'pump-a',
      vendor: 'Sample Pumps Co.',
      model: 'SP-80-200',
      speedRpm: 1450,
      impellerDiameter: 0.218,
      motorPowerRated: 7.5,
      curveBasis: 'water',
      curves: {
        head: [
          { flowRate: 0.0, value: 28.5 },
          { flowRate: 0.01, value: 25.7 },
          { flowRate: 0.02, value: 22.0 },
          { flowRate: 0.03, value: 17.4 },
          { flowRate: 0.035, value: 14.2 }
        ],
        efficiency: [
          { flowRate: 0.0, value: 0.0 },
          { flowRate: 0.01, value: 0.63 },
          { flowRate: 0.018, value: 0.77 },
          { flowRate: 0.022, value: 0.79 },
          { flowRate: 0.03, value: 0.72 },
          { flowRate: 0.035, value: 0.60 }
        ],
        power: [
          { flowRate: 0.0, value: 2.5 },
          { flowRate: 0.01, value: 3.7 },
          { flowRate: 0.02, value: 5.4 },
          { flowRate: 0.03, value: 6.6 },
          { flowRate: 0.035, value: 7.0 }
        ],
        npshr: [
          { flowRate: 0.0, value: 1.8 },
          { flowRate: 0.01, value: 2.2 },
          { flowRate: 0.02, value: 2.9 },
          { flowRate: 0.03, value: 3.8 },
          { flowRate: 0.035, value: 4.5 }
        ]
      }
    },
    {
      id: 'pump-b',
      vendor: 'Sample Pumps Co.',
      model: 'SP-65-200',
      speedRpm: 1750,
      impellerDiameter: 0.205,
      motorPowerRated: 11.0,
      curveBasis: 'water',
      curves: {
        head: [
          { flowRate: 0.0, value: 36.0 },
          { flowRate: 0.01, value: 31.5 },
          { flowRate: 0.02, value: 26.8 },
          { flowRate: 0.03, value: 20.9 },
          { flowRate: 0.04, value: 14.0 }
        ],
        efficiency: [
          { flowRate: 0.0, value: 0.0 },
          { flowRate: 0.01, value: 0.58 },
          { flowRate: 0.02, value: 0.74 },
          { flowRate: 0.026, value: 0.81 },
          { flowRate: 0.032, value: 0.79 },
          { flowRate: 0.04, value: 0.68 }
        ],
        power: [
          { flowRate: 0.0, value: 3.4 },
          { flowRate: 0.01, value: 5.0 },
          { flowRate: 0.02, value: 7.2 },
          { flowRate: 0.03, value: 9.0 },
          { flowRate: 0.04, value: 10.2 }
        ],
        npshr: [
          { flowRate: 0.0, value: 2.0 },
          { flowRate: 0.01, value: 2.6 },
          { flowRate: 0.02, value: 3.5 },
          { flowRate: 0.03, value: 4.7 },
          { flowRate: 0.04, value: 5.8 }
        ]
      }
    }
  ];
}

function buildBaseCase(fluidId, overrides = {}) {
  const fluid = getFluidPresetById(fluidId);
  const material = getMaterialPresetById(overrides.materialPresetId || 'commercial_steel');
  const suctionSegments = overrides.suctionSegments || [
    { name: 'Suction-1', diameter: 0.1, length: 4, roughness: material.roughness }
  ];
  const dischargeSegments = overrides.dischargeSegments || [
    { name: 'Discharge-1', diameter: 0.1, length: 42, roughness: material.roughness },
    { name: 'Discharge-2', diameter: 0.1, length: 12, roughness: material.roughness }
  ];

  return {
    meta: {
      sampleCaseId: overrides.sampleCaseId || 'water_transfer_dummy',
      materialPresetId: material.id
    },
    fluid: {
      presetId: fluid.id,
      name: fluid.label,
      density: overrides.density ?? fluid.density,
      viscosity: overrides.viscosity ?? fluid.viscosity,
      temperature: overrides.temperature ?? fluid.temperature,
      vaporPressureMode: overrides.vaporPressureMode || 'preset',
      vaporPressure: overrides.vaporPressure ?? fluid.vaporPressure
    },
    design: {
      flowBasis: overrides.flowBasis || 'flowRate',
      flowRate: overrides.flowRate ?? 0.02,
      massFlowRate: overrides.massFlowRate ?? null
    },
    pump: {
      elevation: overrides.pumpElevation ?? 0
    },
    suction: {
      sourceType: overrides.suctionSourceType || 'open_tank',
      boundary: {
        pressureAbs: overrides.suctionPressureAbs ?? ATMOSPHERIC_PRESSURE,
        elevation: overrides.suctionElevation ?? 3
      },
      segments: suctionSegments,
      fittings: overrides.suctionFittings || [
        { id: fittingCatalog[6].id, name: fittingCatalog[6].label, segmentIndex: 0, count: 1, k: fittingCatalog[6].k },
        { id: fittingCatalog[2].id, name: fittingCatalog[2].label, segmentIndex: 0, count: 1, k: fittingCatalog[2].k }
      ],
      additionalK: overrides.suctionAdditionalK ?? 0,
      additionalKSegmentIndex: overrides.suctionAdditionalKSegmentIndex ?? 0
    },
    discharge: {
      destinationType: overrides.dischargeDestinationType || 'open_tank',
      boundary: {
        pressureAbs: overrides.dischargePressureAbs ?? ATMOSPHERIC_PRESSURE,
        elevation: overrides.dischargeElevation ?? 18
      },
      segments: dischargeSegments,
      fittings: overrides.dischargeFittings || [
        { id: fittingCatalog[0].id, name: fittingCatalog[0].label, segmentIndex: 0, count: 4, k: fittingCatalog[0].k },
        { id: fittingCatalog[1].id, name: fittingCatalog[1].label, segmentIndex: 1, count: 2, k: fittingCatalog[1].k },
        { id: fittingCatalog[7].id, name: fittingCatalog[7].label, segmentIndex: 1, count: 1, k: fittingCatalog[7].k }
      ],
      additionalK: overrides.dischargeAdditionalK ?? 1.5,
      additionalKSegmentIndex: overrides.dischargeAdditionalKSegmentIndex ?? Math.max(dischargeSegments.length - 1, 0)
    },
    pumpCandidates: overrides.pumpCandidates || buildDefaultPumpCandidates()
  };
}

export const sampleCasePresets = [
  { id: 'water_transfer_dummy', label: 'Dummy — Water transfer (open tank to open tank)' },
  { id: 'methanol_transfer_dummy', label: 'Dummy — Methanol transfer (open tank to pressurized vessel)' },
  { id: 'palm_oil_transfer_dummy', label: 'Dummy — Palm oil transfer (heated line service)' }
];

export function createSampleCaseById(sampleCaseId = 'water_transfer_dummy') {
  switch (sampleCaseId) {
    case 'methanol_transfer_dummy':
      return buildBaseCase('methanol_25c', {
        sampleCaseId,
        flowRate: 0.018,
        suctionElevation: 2.5,
        dischargeDestinationType: 'pressurized_vessel',
        dischargePressureAbs: 145000,
        dischargeElevation: 16,
        dischargeAdditionalK: 2.0,
        dischargeSegments: [
          { name: 'Discharge-1', diameter: 0.08, length: 30, roughness: getMaterialPresetById('stainless_steel').roughness },
          { name: 'Discharge-2', diameter: 0.08, length: 8, roughness: getMaterialPresetById('stainless_steel').roughness }
        ],
        suctionSegments: [
          { name: 'Suction-1', diameter: 0.08, length: 3.5, roughness: getMaterialPresetById('stainless_steel').roughness }
        ],
        materialPresetId: 'stainless_steel'
      });
    case 'palm_oil_transfer_dummy':
      return buildBaseCase('palm_oil_60c', {
        sampleCaseId,
        flowRate: 0.012,
        suctionElevation: 1.5,
        dischargeElevation: 9,
        pumpElevation: 0,
        suctionSegments: [
          { name: 'Suction-1', diameter: 0.125, length: 5, roughness: getMaterialPresetById('commercial_steel').roughness }
        ],
        dischargeSegments: [
          { name: 'Discharge-1', diameter: 0.125, length: 18, roughness: getMaterialPresetById('commercial_steel').roughness },
          { name: 'Discharge-2', diameter: 0.125, length: 10, roughness: getMaterialPresetById('commercial_steel').roughness }
        ],
        dischargeAdditionalK: 2.8,
        dischargeAdditionalKSegmentIndex: 1,
        materialPresetId: 'commercial_steel'
      });
    case 'water_transfer_dummy':
    default:
      return buildBaseCase('water_25c', {
        sampleCaseId,
        materialPresetId: 'commercial_steel'
      });
  }
}

export function createSampleCase() {
  return createSampleCaseById('water_transfer_dummy');
}
