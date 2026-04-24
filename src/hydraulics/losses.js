import { GRAVITY } from '../core/units.js';
import { relativeRoughness } from './geometry.js';
import { velocityFromFlowRate, reynoldsNumber } from './flow.js';
import { frictionFactor } from './friction.js';

export function majorHeadLoss(frictionFactorValue, length, diameter, velocity) {
  return frictionFactorValue * (length / diameter) * (velocity * velocity / (2 * GRAVITY));
}

export function minorHeadLoss(totalK, velocity) {
  return totalK * (velocity * velocity / (2 * GRAVITY));
}

export function fittingSubtotalK(fitting) {
  return (fitting.count || 0) * (fitting.k || 0);
}

export function evaluateSegments(flowRate, density, viscosity, segments) {
  return segments.map((segment, index) => {
    const velocity = velocityFromFlowRate(flowRate, segment.diameter);
    const reynolds = reynoldsNumber(density, velocity, segment.diameter, viscosity);
    const relRoughness = relativeRoughness(segment.roughness, segment.diameter);
    const friction = frictionFactor(reynolds, relRoughness);
    const headLoss = majorHeadLoss(friction.factor, segment.length, segment.diameter, velocity);
    return {
      ...segment,
      index,
      velocity,
      reynolds,
      relativeRoughness: relRoughness,
      frictionFactor: friction.factor,
      regime: friction.regime,
      frictionMethod: friction.method,
      majorHeadLoss: headLoss
    };
  });
}

export function evaluateFittings(flowRate, fittings, segmentResults) {
  return fittings.map((fitting) => {
    const targetSegment = segmentResults[fitting.segmentIndex] || null;
    const velocity = targetSegment ? targetSegment.velocity : 0;
    const subtotalK = fittingSubtotalK(fitting);
    return {
      ...fitting,
      segmentName: targetSegment?.name || `Segment ${fitting.segmentIndex + 1}`,
      segmentDiameter: targetSegment?.diameter || 0,
      velocity,
      subtotalK,
      headLoss: minorHeadLoss(subtotalK, velocity)
    };
  });
}

export function evaluateSide(flowRate, density, viscosity, side) {
  const segmentResults = evaluateSegments(flowRate, density, viscosity, side.segments || []);
  const fittingResults = evaluateFittings(flowRate, side.fittings || [], segmentResults);
  const majorHeadLossTotal = segmentResults.reduce((sum, item) => sum + item.majorHeadLoss, 0);
  const fittingSigmaK = fittingResults.reduce((sum, item) => sum + item.subtotalK, 0);
  const additionalK = side.additionalK || 0;
  const defaultReferenceIndex = Math.max(segmentResults.length - 1, 0);
  const additionalKSegmentIndex = Number.isInteger(side.additionalKSegmentIndex) ? side.additionalKSegmentIndex : defaultReferenceIndex;
  const referenceSegment = segmentResults[additionalKSegmentIndex] || segmentResults[defaultReferenceIndex] || null;
  const referenceVelocity = referenceSegment?.velocity || 0;
  const allowanceHeadLoss = minorHeadLoss(additionalK, referenceVelocity);
  const minorHeadLossTotal = fittingResults.reduce((sum, item) => sum + item.headLoss, 0) + allowanceHeadLoss;
  return {
    segmentResults,
    fittingResults,
    majorHeadLossTotal,
    fittingSigmaK,
    totalSigmaK: fittingSigmaK + additionalK,
    additionalK,
    additionalKSegmentIndex,
    additionalKSegmentName: referenceSegment?.name || `Segment ${additionalKSegmentIndex + 1}`,
    additionalKHeadLoss: allowanceHeadLoss,
    minorHeadLossTotal,
    totalHeadLoss: majorHeadLossTotal + minorHeadLossTotal,
    referenceDiameter: referenceSegment?.diameter || 0,
    referenceVelocity
  };
}
