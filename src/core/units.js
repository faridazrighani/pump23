export const GRAVITY = 9.80665;
export const ATMOSPHERIC_PRESSURE = 101325;

export function toNumber(value, fallback = null) {
  if (value === null || value === undefined || value === '') {
    return fallback;
  }
  const num = Number(value);
  return Number.isFinite(num) ? num : fallback;
}

export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function formatNumber(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  const abs = Math.abs(value);
  if ((abs >= 1e6 || (abs > 0 && abs < 1e-3)) && abs !== 0) {
    return value.toExponential(Math.max(0, digits - 1));
  }
  return Number(value).toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: digits
  });
}

export function formatFixed(value, digits = 4) {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return '-';
  }
  return Number(value).toFixed(digits);
}

export function safeDivide(numerator, denominator, fallback = 0) {
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || Math.abs(denominator) < 1e-15) {
    return fallback;
  }
  return numerator / denominator;
}
