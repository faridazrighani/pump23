const TRANSITION_LIMIT = 4000;

export function churchill(reynolds, relativeRoughness) {
  if (!(reynolds > 0)) {
    return 0;
  }
  const a = Math.pow(
    2.457 * Math.log(1 / (Math.pow(7 / reynolds, 0.9) + 0.27 * relativeRoughness)),
    16
  );
  const b = Math.pow(37530 / reynolds, 16);
  return 8 * Math.pow(Math.pow(8 / reynolds, 12) + 1 / Math.pow(a + b, 1.5), 1 / 12);
}

export function solveColebrook(reynolds, relativeRoughness, tolerance = 1e-10, maxIterations = 100) {
  if (!(reynolds > 0)) {
    return 0;
  }
  let frictionFactor = Math.max(0.008, 0.25 / Math.pow(Math.log10(relativeRoughness / 3.7 + 5.74 / Math.pow(reynolds, 0.9)), 2));

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const left = -2 * Math.log10(relativeRoughness / 3.7 + 2.51 / (reynolds * Math.sqrt(frictionFactor)));
    const next = 1 / (left * left);
    if (Math.abs(next - frictionFactor) < tolerance) {
      return next;
    }
    frictionFactor = next;
  }
  return frictionFactor;
}

export function frictionFactor(reynolds, relativeRoughness) {
  if (!(reynolds > 0)) {
    return { factor: 0, regime: 'Undefined', method: 'Insufficient Reynolds number' };
  }
  if (reynolds < 2300) {
    return { factor: 64 / reynolds, regime: 'Laminar', method: 'Exact laminar relation' };
  }
  if (reynolds <= TRANSITION_LIMIT) {
    return { factor: churchill(reynolds, relativeRoughness), regime: 'Transitional', method: 'Churchill bridging correlation' };
  }
  return { factor: solveColebrook(reynolds, relativeRoughness), regime: 'Turbulent', method: 'Colebrook-White iterative solution' };
}
