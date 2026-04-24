export function bisectionSolve(fn, lower, upper, tolerance = 1e-8, maxIterations = 100) {
  let a = lower;
  let b = upper;
  let fa = fn(a);
  let fb = fn(b);

  if (!Number.isFinite(fa) || !Number.isFinite(fb)) {
    return null;
  }
  if (fa === 0) return a;
  if (fb === 0) return b;
  if (fa * fb > 0) {
    return null;
  }

  for (let iteration = 0; iteration < maxIterations; iteration += 1) {
    const mid = 0.5 * (a + b);
    const fm = fn(mid);
    if (!Number.isFinite(fm)) {
      return null;
    }
    if (Math.abs(fm) < tolerance || Math.abs(b - a) < tolerance) {
      return mid;
    }
    if (fa * fm < 0) {
      b = mid;
      fb = fm;
    } else {
      a = mid;
      fa = fm;
    }
  }
  return 0.5 * (a + b);
}
