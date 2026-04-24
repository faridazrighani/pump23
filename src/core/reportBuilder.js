export function buildSideAuditRows(sideResult) {
  const segmentRows = (sideResult.segmentResults || []).map((segment) => ({
    type: 'segment',
    name: segment.name,
    diameter: segment.diameter,
    length: segment.length,
    roughness: segment.roughness,
    velocity: segment.velocity,
    reynolds: segment.reynolds,
    frictionFactor: segment.frictionFactor,
    headLoss: segment.majorHeadLoss
  }));

  const fittingRows = (sideResult.fittingResults || []).map((fitting) => ({
    type: 'fitting',
    name: fitting.name,
    count: fitting.count,
    kEach: fitting.k,
    subtotalK: fitting.subtotalK,
    headLoss: fitting.headLoss
  }));

  return { segmentRows, fittingRows };
}
