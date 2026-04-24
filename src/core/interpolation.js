export function linearInterpolate(x, x0, y0, x1, y1) {
  const span = x1 - x0;
  if (Math.abs(span) < 1e-15) {
    return y0;
  }
  return y0 + ((x - x0) / span) * (y1 - y0);
}

export function interpolateCurve(points, x, xKey = 'x', yKey = 'y') {
  if (!Array.isArray(points) || points.length === 0) {
    return null;
  }
  if (x <= points[0][xKey]) {
    return points[0][yKey];
  }
  for (let index = 1; index < points.length; index += 1) {
    if (x <= points[index][xKey]) {
      return linearInterpolate(
        x,
        points[index - 1][xKey],
        points[index - 1][yKey],
        points[index][xKey],
        points[index][yKey]
      );
    }
  }
  return points[points.length - 1][yKey];
}
