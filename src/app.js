import { toNumber, formatNumber, ATMOSPHERIC_PRESSURE } from './core/units.js';
import { fluidPresets, getFluidPresetById, resolvePresetVaporPressure } from './data/fluids.js';
import { materialPresets, getMaterialPresetById } from './data/materials.js';
import { createSampleCase, createSampleCaseById, sampleCasePresets } from './data/sampleCases.js';
import { preparePumpCandidatesForCase } from './pump/pumpCatalog.js';
import { summarizePumpCandidate } from './pump/pumpCurve.js';
import { solveOperatingPointsForCandidates, evaluateDecisionForCandidates } from './pump/selectionEngine.js';
import { computeHydraulicState, computeSystemCurve } from './hydraulics/systemCurve.js';
import { computeNpsha, resolveVaporPressure } from './hydraulics/npsh.js';
import { populateSelect } from './ui/formFluid.js';
import { createSegmentRow, createFittingRow, readSegmentRows, readFittingRows, refreshFittingSegmentOptions, populateSegmentIndexSelect } from './ui/formPiping.js';
import { parsePumpCandidatesJson } from './ui/formPump.js';
import { renderSummary, renderSideAudit, renderSystemCurveTable } from './ui/resultsHydraulic.js';
import { renderPumpCurveSummary } from './ui/resultsSelection.js';
import { renderSystemCurveChart, renderPumpMetricChart } from './ui/charts.js';
import { downloadJson } from './ui/export.js';

const elements = {
  fluidPreset: document.getElementById('fluidPreset'),
  materialPreset: document.getElementById('materialPreset'),
  sampleCasePreset: document.getElementById('sampleCasePreset'),
  flowBasis: document.getElementById('flowBasis'),
  flowRate: document.getElementById('flowRate'),
  massFlowRate: document.getElementById('massFlowRate'),
  temperature: document.getElementById('temperature'),
  density: document.getElementById('density'),
  viscosity: document.getElementById('viscosity'),
  vaporPressureMode: document.getElementById('vaporPressureMode'),
  vaporPressure: document.getElementById('vaporPressure'),
  suctionSourceType: document.getElementById('suctionSourceType'),
  suctionPressureAbs: document.getElementById('suctionPressureAbs'),
  suctionElevation: document.getElementById('suctionElevation'),
  pumpElevation: document.getElementById('pumpElevation'),
  dischargeDestinationType: document.getElementById('dischargeDestinationType'),
  dischargePressureAbs: document.getElementById('dischargePressureAbs'),
  dischargeElevation: document.getElementById('dischargeElevation'),
  suctionSegments: document.getElementById('suctionSegments'),
  dischargeSegments: document.getElementById('dischargeSegments'),
  suctionFittings: document.getElementById('suctionFittings'),
  dischargeFittings: document.getElementById('dischargeFittings'),
  suctionAdditionalK: document.getElementById('suctionAdditionalK'),
  suctionAdditionalKSegment: document.getElementById('suctionAdditionalKSegment'),
  dischargeAdditionalK: document.getElementById('dischargeAdditionalK'),
  dischargeAdditionalKSegment: document.getElementById('dischargeAdditionalKSegment'),
  pumpCandidatesJson: document.getElementById('pumpCandidatesJson'),
  summaryCards: document.getElementById('summaryCards'),
  suctionAuditTable: document.getElementById('suctionAuditTable'),
  dischargeAuditTable: document.getElementById('dischargeAuditTable'),
  toggleSystemCurveTableBtn: document.getElementById('toggleSystemCurveTableBtn'),
  systemCurveTablePanel: document.getElementById('systemCurveTablePanel'),
  systemCurveTable: document.getElementById('systemCurveTable'),
  caseModelSnapshot: document.getElementById('caseModelSnapshot'),
  systemCurveChart: document.getElementById('systemCurveChart'),
  pumpCurveSummary: document.getElementById('pumpCurveSummary'),
  pumpHeadChart: document.getElementById('pumpHeadChart'),
  pumpEfficiencyChart: document.getElementById('pumpEfficiencyChart'),
  pumpPowerChart: document.getElementById('pumpPowerChart'),
  pumpNpshrChart: document.getElementById('pumpNpshrChart'),
  messageBox: document.getElementById('messageBox')
};

function showMessage(message, type = 'success') {
  elements.messageBox.textContent = message;
  elements.messageBox.className = `message-box ${type}`;
}

function clearRows(container) {
  container.innerHTML = '';
}

function defaultSegment(name, roughness) {
  return { name, diameter: 0.1, length: 10, roughness };
}

function defaultFitting(segmentIndex = 0) {
  return { id: 'elbow_90_standard', segmentIndex, count: 1, k: 0.9 };
}

function nearlyEqual(a, b, absoluteTolerance = 1e-9, relativeTolerance = 1e-6) {
  if (!Number.isFinite(a) || !Number.isFinite(b)) return false;
  const delta = Math.abs(a - b);
  return delta <= Math.max(absoluteTolerance, Math.max(Math.abs(a), Math.abs(b)) * relativeTolerance);
}

function setReadOnlyState(input, locked, forcedValue = null) {
  if (!input) return;
  if (forcedValue !== null && forcedValue !== undefined) {
    input.value = forcedValue;
  }
  input.readOnly = Boolean(locked);
  input.classList.toggle('readonly-input', Boolean(locked));
}

function inferMaterialPresetIdFromCase(caseModel) {
  const allSegments = [
    ...(caseModel?.suction?.segments || []),
    ...(caseModel?.discharge?.segments || [])
  ];

  const roughnesses = allSegments
    .map((segment) => Number(segment?.roughness))
    .filter((value) => Number.isFinite(value));

  if (!roughnesses.length) {
    return caseModel?.meta?.materialPresetId || materialPresets[0]?.id;
  }

  const matched = materialPresets.find((preset) => roughnesses.every((value) => nearlyEqual(value, preset.roughness)));
  return matched?.id || caseModel?.meta?.materialPresetId || elements.materialPreset.value || materialPresets[0]?.id;
}

function syncFittingSegmentOptions() {
  const suctionCount = elements.suctionSegments.children.length;
  const dischargeCount = elements.dischargeSegments.children.length;
  refreshFittingSegmentOptions(elements.suctionFittings, suctionCount);
  refreshFittingSegmentOptions(elements.dischargeFittings, dischargeCount);
  populateSegmentIndexSelect(elements.suctionAdditionalKSegment, suctionCount, Math.min(Number(elements.suctionAdditionalKSegment.value) || 0, Math.max(suctionCount - 1, 0)));
  populateSegmentIndexSelect(elements.dischargeAdditionalKSegment, dischargeCount, Math.min(Number(elements.dischargeAdditionalKSegment.value) || 0, Math.max(dischargeCount - 1, 0)));
}

function addSegment(container, fittingContainer, name, roughness) {
  createSegmentRow(container, defaultSegment(name, roughness), () => syncFittingSegmentOptions());
  refreshFittingSegmentOptions(fittingContainer, container.children.length);
  syncFittingSegmentOptions();
}

function addFitting(container, segmentContainer) {
  createFittingRow(container, defaultFitting(0), segmentContainer.children.length);
}

function updateFlowBasisUi() {
  const basis = elements.flowBasis.value;
  const useFlowRate = basis === 'flowRate';
  setReadOnlyState(elements.flowRate, !useFlowRate);
  setReadOnlyState(elements.massFlowRate, useFlowRate);
}

function updateBoundaryModeUi() {
  const suctionOpenTank = elements.suctionSourceType.value === 'open_tank';
  const dischargeOpenTank = elements.dischargeDestinationType.value === 'open_tank';
  setReadOnlyState(elements.suctionPressureAbs, suctionOpenTank, suctionOpenTank ? ATMOSPHERIC_PRESSURE : null);
  setReadOnlyState(elements.dischargePressureAbs, dischargeOpenTank, dischargeOpenTank ? ATMOSPHERIC_PRESSURE : null);
}

function applyFluidPreset(presetId) {
  const preset = getFluidPresetById(presetId);
  elements.density.value = preset.density;
  elements.viscosity.value = preset.viscosity;
  elements.temperature.value = preset.temperature;

  if (elements.vaporPressureMode.value !== 'manual') {
    elements.vaporPressure.value = preset.vaporPressure;
  }

  if (elements.suctionSourceType.value === 'open_tank') {
    elements.suctionPressureAbs.value = preset.sourcePressureAbs;
  }
  if (elements.dischargeDestinationType.value === 'open_tank') {
    elements.dischargePressureAbs.value = preset.destinationPressureAbs;
  }

  updateBoundaryModeUi();
  updateVaporPressureMode();
}

function applyMaterialPreset(materialId, { overwriteExisting = true } = {}) {
  const material = getMaterialPresetById(materialId);
  [elements.suctionSegments, elements.dischargeSegments].forEach((container) => {
    Array.from(container.children).forEach((row) => {
      const roughnessInput = row.querySelector('[data-field="roughness"]');
      if (!roughnessInput) return;
      if (overwriteExisting || !roughnessInput.value || Number(roughnessInput.value) === 0) {
        roughnessInput.value = material.roughness;
      }
    });
  });
}

function updateVaporPressureMode() {
  const isManual = elements.vaporPressureMode.value === 'manual';
  setReadOnlyState(elements.vaporPressure, !isManual);
  if (!isManual) {
    const resolved = resolvePresetVaporPressure(elements.fluidPreset.value, toNumber(elements.temperature.value, 0));
    elements.vaporPressure.value = resolved ?? '';
    elements.vaporPressure.title = resolved === null
      ? 'Preset vapor pressure is only available at the tabulated preset temperature. Switch to manual override if project Pv differs.'
      : '';
  } else {
    elements.vaporPressure.title = 'Manual vapor-pressure override is active.';
  }
}

function buildCaseModelFromDom() {
  let rawPumpCandidates = [];
  try {
    rawPumpCandidates = parsePumpCandidatesJson(elements.pumpCandidatesJson.value);
  } catch (error) {
    throw new Error(`Pump candidate JSON is invalid: ${error.message}`);
  }

  const vaporPressureMode = elements.vaporPressureMode.value;
  const fluidPresetId = elements.fluidPreset.value;
  const temperature = toNumber(elements.temperature.value, 25);
  const resolvedPresetVaporPressure = resolvePresetVaporPressure(fluidPresetId, temperature);

  const fluid = {
    presetId: fluidPresetId,
    name: elements.fluidPreset.options[elements.fluidPreset.selectedIndex]?.textContent || fluidPresetId,
    density: toNumber(elements.density.value),
    viscosity: toNumber(elements.viscosity.value),
    temperature,
    vaporPressureMode,
    vaporPressure: vaporPressureMode === 'manual'
      ? toNumber(elements.vaporPressure.value, 0)
      : resolvedPresetVaporPressure
  };
  const pumpCandidates = preparePumpCandidatesForCase(rawPumpCandidates, fluid);

  return {
    meta: {
      materialPresetId: elements.materialPreset.value
    },
    fluid,
    design: {
      flowBasis: elements.flowBasis.value,
      flowRate: toNumber(elements.flowRate.value, 0),
      massFlowRate: toNumber(elements.massFlowRate.value, 0)
    },
    pump: {
      elevation: toNumber(elements.pumpElevation.value, 0)
    },
    suction: {
      sourceType: elements.suctionSourceType.value,
      boundary: {
        pressureAbs: toNumber(elements.suctionPressureAbs.value, ATMOSPHERIC_PRESSURE),
        elevation: toNumber(elements.suctionElevation.value, 0)
      },
      segments: readSegmentRows(elements.suctionSegments),
      fittings: readFittingRows(elements.suctionFittings),
      additionalK: toNumber(elements.suctionAdditionalK.value, 0),
      additionalKSegmentIndex: Number(elements.suctionAdditionalKSegment.value || 0)
    },
    discharge: {
      destinationType: elements.dischargeDestinationType.value,
      boundary: {
        pressureAbs: toNumber(elements.dischargePressureAbs.value, ATMOSPHERIC_PRESSURE),
        elevation: toNumber(elements.dischargeElevation.value, 0)
      },
      segments: readSegmentRows(elements.dischargeSegments),
      fittings: readFittingRows(elements.dischargeFittings),
      additionalK: toNumber(elements.dischargeAdditionalK.value, 0),
      additionalKSegmentIndex: Number(elements.dischargeAdditionalKSegment.value || 0)
    },
    pumpCandidates
  };
}

function populateCaseModel(caseModel) {
  const fluidPreset = caseModel.fluid?.presetId
    ? getFluidPresetById(caseModel.fluid.presetId)
    : (fluidPresets.find((item) => item.label === caseModel.fluid.name) || fluidPresets[0]);
  const materialPresetId = inferMaterialPresetIdFromCase(caseModel);
  if (elements.sampleCasePreset && caseModel?.meta?.sampleCaseId) {
    elements.sampleCasePreset.value = caseModel.meta.sampleCaseId;
  }

  elements.fluidPreset.value = fluidPreset.id;
  elements.materialPreset.value = materialPresetId;
  elements.density.value = caseModel.fluid.density;
  elements.viscosity.value = caseModel.fluid.viscosity;
  elements.temperature.value = caseModel.fluid.temperature;
  elements.vaporPressureMode.value = caseModel.fluid.vaporPressureMode || 'preset';
  elements.vaporPressure.value = caseModel.fluid.vaporPressure;
  elements.flowBasis.value = caseModel.design.flowBasis || 'flowRate';
  elements.flowRate.value = caseModel.design.flowRate ?? '';
  elements.massFlowRate.value = caseModel.design.massFlowRate ?? '';
  elements.pumpElevation.value = caseModel.pump.elevation;
  elements.suctionSourceType.value = caseModel.suction.sourceType;
  elements.suctionPressureAbs.value = caseModel.suction.boundary.pressureAbs;
  elements.suctionElevation.value = caseModel.suction.boundary.elevation;
  elements.dischargeDestinationType.value = caseModel.discharge.destinationType;
  elements.dischargePressureAbs.value = caseModel.discharge.boundary.pressureAbs;
  elements.dischargeElevation.value = caseModel.discharge.boundary.elevation;
  elements.suctionAdditionalK.value = caseModel.suction.additionalK;
  elements.dischargeAdditionalK.value = caseModel.discharge.additionalK;

  clearRows(elements.suctionSegments);
  clearRows(elements.dischargeSegments);
  clearRows(elements.suctionFittings);
  clearRows(elements.dischargeFittings);

  caseModel.suction.segments.forEach((segment) => createSegmentRow(elements.suctionSegments, segment, () => syncFittingSegmentOptions()));
  caseModel.discharge.segments.forEach((segment) => createSegmentRow(elements.dischargeSegments, segment, () => syncFittingSegmentOptions()));
  caseModel.suction.fittings.forEach((fitting) => createFittingRow(elements.suctionFittings, fitting, caseModel.suction.segments.length));
  caseModel.discharge.fittings.forEach((fitting) => createFittingRow(elements.dischargeFittings, fitting, caseModel.discharge.segments.length));
  syncFittingSegmentOptions();
  elements.suctionAdditionalKSegment.value = String(caseModel.suction.additionalKSegmentIndex ?? Math.max(caseModel.suction.segments.length - 1, 0));
  elements.dischargeAdditionalKSegment.value = String(caseModel.discharge.additionalKSegmentIndex ?? Math.max(caseModel.discharge.segments.length - 1, 0));
  syncFittingSegmentOptions();
  updateFlowBasisUi();
  updateBoundaryModeUi();
  updateVaporPressureMode();
  elements.pumpCandidatesJson.value = JSON.stringify(caseModel.pumpCandidates || [], null, 2);
}

function clearPumpCharts() {
  [elements.pumpHeadChart, elements.pumpEfficiencyChart, elements.pumpPowerChart, elements.pumpNpshrChart].forEach((svg) => {
    svg.innerHTML = '';
  });
}

function setSystemCurveTableVisibility(isVisible) {
  if (!elements.systemCurveTablePanel || !elements.toggleSystemCurveTableBtn) return;
  elements.systemCurveTablePanel.classList.toggle('is-collapsed', !isVisible);
  elements.toggleSystemCurveTableBtn.setAttribute('aria-expanded', String(isVisible));
  elements.toggleSystemCurveTableBtn.textContent = isVisible ? 'Hide table' : 'Show table';
}

function toggleSystemCurveTable() {
  const isCurrentlyVisible = !elements.systemCurveTablePanel?.classList.contains('is-collapsed');
  setSystemCurveTableVisibility(!isCurrentlyVisible);
}

const PUMP_SERIES_COLORS = ['#204f74', '#a36a38', '#3c7c62', '#7d5ba6', '#a14159', '#4a6f9d'];

function buildPumpColorMap(summaries) {
  return new Map((summaries || []).map((summary, index) => [summary.id || summary.model, PUMP_SERIES_COLORS[index % PUMP_SERIES_COLORS.length]]));
}

function buildMetricSeries(summaries, key, colorMap = new Map()) {
  return summaries
    .map((summary) => ({
      label: summary.model,
      color: colorMap.get(summary.id || summary.model),
      points: summary.curveSeries[key] || []
    }))
    .filter((series) => series.points.length > 0);
}

function buildOperatingMetricMarkers(operatingPoints, colorMap, key, labelSuffix = 'op') {
  return (operatingPoints || [])
    .filter((item) => item.status === 'solved' && Number.isFinite(item.flowRate) && Number.isFinite(item[key]))
    .map((item) => ({
      label: `${item.model} ${labelSuffix}`,
      flowRate: item.flowRate,
      value: item[key],
      color: colorMap.get(item.candidateId || item.model) || '#7d5ba6'
    }));
}

function runSolver() {
  try {
    const caseModel = buildCaseModelFromDom();
    const state = computeHydraulicState(caseModel);
    const npsha = computeNpsha(caseModel, state);
    const curve = computeSystemCurve(caseModel);
    const result = { ...state, npsha, vaporPressureResolved: resolveVaporPressure(caseModel) };
    const pumpSummaries = caseModel.pumpCandidates.map((candidate) => summarizePumpCandidate(candidate, result.flowRate, result.totalHead));
    const operatingPoints = solveOperatingPointsForCandidates(caseModel, caseModel.pumpCandidates, { systemMaxFlow: curve[curve.length - 1]?.flowRate ?? null });
    const decisions = evaluateDecisionForCandidates(caseModel, pumpSummaries, operatingPoints, result.totalHead);
    const decisionMap = new Map(decisions.map((item) => [item.candidateId || item.model, item]));
    const pumpColorMap = buildPumpColorMap(pumpSummaries);
    const operatingPointsWithColors = operatingPoints.map((item) => ({
      ...item,
      color: pumpColorMap.get(item.candidateId || item.model) || '#7d5ba6',
      decision: decisionMap.get(item.candidateId || item.model) || null
    }));

    renderSummary(elements.summaryCards, result);
    renderSideAudit(elements.suctionAuditTable, result.suction);
    renderSideAudit(elements.dischargeAuditTable, result.discharge);
    renderSystemCurveTable(elements.systemCurveTable, curve);
    renderSystemCurveChart(elements.systemCurveChart, curve, { flowRate: result.flowRate, totalHead: result.totalHead }, operatingPointsWithColors);
    renderPumpCurveSummary(elements.pumpCurveSummary, pumpSummaries, result.totalHead, operatingPointsWithColors, decisions);

    const headSeries = [
      {
        label: 'System curve',
        color: '#111827',
        strokeDasharray: '7 5',
        points: curve.map((item) => ({ flowRate: item.flowRate, value: item.totalHead }))
      },
      ...buildMetricSeries(pumpSummaries, 'head', pumpColorMap)
    ];

    const headMarkers = buildOperatingMetricMarkers(operatingPointsWithColors, pumpColorMap, 'pumpHead');
    const efficiencyMarkers = buildOperatingMetricMarkers(operatingPointsWithColors, pumpColorMap, 'efficiency');
    const powerMarkers = buildOperatingMetricMarkers(operatingPointsWithColors, pumpColorMap, 'power');
    const npshrMarkers = buildOperatingMetricMarkers(operatingPointsWithColors, pumpColorMap, 'npshr');

    renderPumpMetricChart(elements.pumpHeadChart, headSeries, { dutyFlowRate: result.flowRate, yLabel: 'Head (m)', markers: headMarkers });
    renderPumpMetricChart(elements.pumpEfficiencyChart, buildMetricSeries(pumpSummaries, 'efficiency', pumpColorMap), { dutyFlowRate: result.flowRate, yLabel: 'Efficiency (-)', markers: efficiencyMarkers });
    renderPumpMetricChart(elements.pumpPowerChart, buildMetricSeries(pumpSummaries, 'power', pumpColorMap), { dutyFlowRate: result.flowRate, yLabel: 'Power (kW)', markers: powerMarkers });
    renderPumpMetricChart(elements.pumpNpshrChart, buildMetricSeries(pumpSummaries, 'npshr', pumpColorMap), { dutyFlowRate: result.flowRate, yLabel: 'NPSHR (m)', markers: npshrMarkers });
    elements.caseModelSnapshot.textContent = JSON.stringify(caseModel, null, 2);

    const solvedCount = operatingPointsWithColors.filter((item) => item.status === 'solved').length;
    const acceptedCount = decisions.filter((item) => item.decision === 'accepted').length;
    const cautionCount = decisions.filter((item) => item.decision === 'accepted_with_caution').length;
    const rejectedCount = decisions.filter((item) => item.decision === 'rejected').length;
    const candidateMessage = pumpSummaries.length
      ? ` Pump curves loaded: ${pumpSummaries.length} candidate(s), operating points solved: ${solvedCount}, decisions = ${acceptedCount} accepted / ${cautionCount} caution / ${rejectedCount} rejected.`
      : ' No pump candidates loaded yet.';
    showMessage(`Tahap E screening completed. Duty head = ${formatNumber(result.totalHead, 4)} m, NPSHA = ${formatNumber(result.npsha, 4)} m.${candidateMessage}`);
  } catch (error) {
    clearPumpCharts();
    showMessage(error.message, 'error');
  }
}

function init() {
  populateSelect(elements.fluidPreset, fluidPresets, 'water_25c');
  populateSelect(elements.materialPreset, materialPresets, 'commercial_steel');
  populateSelect(elements.sampleCasePreset, sampleCasePresets, 'water_transfer_dummy');
  applyFluidPreset('water_25c');

  const defaultRoughness = getMaterialPresetById('commercial_steel').roughness;
  addSegment(elements.suctionSegments, elements.suctionFittings, 'Suction-1', defaultRoughness);
  addSegment(elements.dischargeSegments, elements.dischargeFittings, 'Discharge-1', defaultRoughness);
  addFitting(elements.suctionFittings, elements.suctionSegments);
  addFitting(elements.dischargeFittings, elements.dischargeSegments);

  elements.fluidPreset.addEventListener('change', () => applyFluidPreset(elements.fluidPreset.value));
  elements.materialPreset.addEventListener('change', () => applyMaterialPreset(elements.materialPreset.value, { overwriteExisting: true }));
  elements.flowBasis.addEventListener('change', updateFlowBasisUi);
  elements.suctionSourceType.addEventListener('change', updateBoundaryModeUi);
  elements.dischargeDestinationType.addEventListener('change', updateBoundaryModeUi);
  elements.temperature.addEventListener('input', updateVaporPressureMode);
  elements.vaporPressureMode.addEventListener('change', updateVaporPressureMode);
  document.getElementById('addSuctionSegmentBtn').addEventListener('click', () => addSegment(elements.suctionSegments, elements.suctionFittings, `Suction-${elements.suctionSegments.children.length + 1}`, getMaterialPresetById(elements.materialPreset.value).roughness));
  document.getElementById('addDischargeSegmentBtn').addEventListener('click', () => addSegment(elements.dischargeSegments, elements.dischargeFittings, `Discharge-${elements.dischargeSegments.children.length + 1}`, getMaterialPresetById(elements.materialPreset.value).roughness));
  document.getElementById('addSuctionFittingBtn').addEventListener('click', () => addFitting(elements.suctionFittings, elements.suctionSegments));
  document.getElementById('addDischargeFittingBtn').addEventListener('click', () => addFitting(elements.dischargeFittings, elements.dischargeSegments));
  document.getElementById('runBtn').addEventListener('click', runSolver);
  elements.toggleSystemCurveTableBtn?.addEventListener('click', toggleSystemCurveTable);
  document.getElementById('loadSampleBtn').addEventListener('click', () => {
    const selectedSampleCaseId = elements.sampleCasePreset.value || 'water_transfer_dummy';
    populateCaseModel(createSampleCaseById(selectedSampleCaseId));
    showMessage(`Sample case loaded: ${elements.sampleCasePreset.options[elements.sampleCasePreset.selectedIndex]?.textContent || selectedSampleCaseId}.`);
  });
  document.getElementById('exportCaseBtn').addEventListener('click', () => {
    try {
      downloadJson('pump-selection-case.json', buildCaseModelFromDom());
      showMessage('Case model exported as JSON.');
    } catch (error) {
      showMessage(error.message, 'error');
    }
  });

  populateCaseModel(createSampleCase());
  runSolver();
}

init();
