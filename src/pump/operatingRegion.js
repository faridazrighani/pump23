import { safeDivide } from '../core/units.js';
import { standardsRules } from '../data/standardsRules.js';

export function classifyOperatingRegion(flowRate, bepFlowRate, overrides = {}) {
  const rules = {
    ...standardsRules.operatingRegion,
    ...overrides
  };

  if (!Number.isFinite(flowRate) || !Number.isFinite(bepFlowRate) || bepFlowRate <= 0) {
    return {
      status: 'unknown',
      label: 'Region unknown',
      ratioToBep: null,
      note: 'BEP flow is unavailable, so POR/AOR classification cannot yet be confirmed.'
    };
  }

  const ratioToBep = safeDivide(flowRate, bepFlowRate, null);

  if (ratioToBep >= rules.porMin && ratioToBep <= rules.porMax) {
    return {
      status: 'por',
      label: 'Inside POR',
      ratioToBep,
      note: rules.note
    };
  }

  if (ratioToBep >= rules.aorMin && ratioToBep <= rules.aorMax) {
    return {
      status: 'aor',
      label: 'Inside AOR',
      ratioToBep,
      note: rules.note
    };
  }

  return {
    status: 'outside_aor',
    label: 'Outside AOR',
    ratioToBep,
    note: rules.note
  };
}
