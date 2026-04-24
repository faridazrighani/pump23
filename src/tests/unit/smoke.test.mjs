import { createSampleCase, createSampleCaseById, sampleCasePresets } from '../../data/sampleCases.js';
import { computeHydraulicState } from '../../hydraulics/systemCurve.js';
import { computeNpsha } from '../../hydraulics/npsh.js';
import { preparePumpCandidatesForCase } from '../../pump/pumpCatalog.js';
import { summarizePumpCandidate } from '../../pump/pumpCurve.js';
import { solveOperatingPointsForCandidates, evaluateDecisionForCandidates } from '../../pump/selectionEngine.js';

function runSelection(caseModel) {
  const preparedCandidates = preparePumpCandidatesForCase(caseModel.pumpCandidates, caseModel.fluid);
  const preparedCase = {
    ...caseModel,
    pumpCandidates: preparedCandidates
  };
  const state = computeHydraulicState(preparedCase);
  const npsha = computeNpsha(preparedCase, state);
  const candidateSummaries = preparedCase.pumpCandidates.map((candidate) => summarizePumpCandidate(candidate, state.flowRate, state.totalHead));
  const operatingPoints = solveOperatingPointsForCandidates(preparedCase, preparedCase.pumpCandidates);
  const decisions = evaluateDecisionForCandidates(preparedCase, candidateSummaries, operatingPoints, state.totalHead);

  return {
    caseModel: preparedCase,
    state,
    npsha,
    candidateSummaries,
    operatingPoints,
    decisions
  };
}

const result = runSelection(createSampleCase());

console.log({
  flowRate: result.state.flowRate,
  totalHead: result.state.totalHead,
  npsha: result.npsha,
  operatingPoints: result.operatingPoints.map((item) => ({ model: item.model, status: item.status, flowRate: item.flowRate, pumpHead: item.pumpHead })),
  decisions: result.decisions.map((item) => ({ model: item.model, decision: item.decision, score: item.score })),
  pumpCandidates: result.candidateSummaries.map((item) => ({
    model: item.model,
    headAtDuty: item.headAtDuty,
    bepFlowRate: item.bepFlowRate,
    npshrAtDuty: item.npshrAtDuty,
    adjustments: item.curveAdjustments
  }))
});

if (!(result.state.staticHead > 0)) { throw new Error('Expected positive static head in sample case.'); }
if (result.caseModel.discharge.additionalKSegmentIndex !== 1) { throw new Error('Expected discharge additional Sigma K to map to segment 2 in sample case.'); }
if (!result.operatingPoints.some((item) => item.status === 'solved')) { throw new Error('Expected at least one solved operating point in sample case.'); }
if (!result.decisions.some((item) => item.decision === 'accepted' || item.decision === 'accepted_with_caution')) { throw new Error('Expected at least one non-rejected screening decision in sample case.'); }

for (const sampleCaseMeta of sampleCasePresets) {
  const candidateCase = createSampleCaseById(sampleCaseMeta.id);
  if (!candidateCase?.fluid?.presetId) throw new Error(`Expected presetId on sample case: ${sampleCaseMeta.id}`);

  const candidateResult = runSelection(candidateCase);
  if (!(candidateResult.state.flowRate > 0)) throw new Error(`Expected positive flow for sample case: ${sampleCaseMeta.id}`);
  if (!Number.isFinite(candidateResult.npsha)) throw new Error(`Expected finite NPSHA for sample case: ${sampleCaseMeta.id}`);
  if (!candidateResult.operatingPoints.length) throw new Error(`Expected operating-point attempts for sample case: ${sampleCaseMeta.id}`);

  if (sampleCaseMeta.id === 'palm_oil_transfer_dummy') {
    const corrected = candidateResult.caseModel.pumpCandidates.some((candidate) => candidate.curveAdjustments?.viscosity?.applied);
    if (!corrected) throw new Error('Expected Tahap F viscosity correction to be applied for palm oil sample case.');
  }
}
