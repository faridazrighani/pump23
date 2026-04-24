import { formatNumber } from '../core/units.js';

const SERIES_COLORS = ['#204f74', '#a36a38', '#3c7c62', '#7d5ba6', '#a14159', '#4a6f9d'];
const CHART_WIDTH = 820;
const SYSTEM_CHART_HEIGHT = 460;
const METRIC_CHART_HEIGHT = 390;
const SYSTEM_PADDING = { left: 86, right: 36, top: 38, bottom: 82 };
const METRIC_PADDING = { left: 86, right: 36, top: 52, bottom: 78 };
const GRID_COLOR = 'rgba(24,36,51,0.07)';
const AXIS_COLOR = '#263647';
const LABEL_COLOR = '#5f6f81';

function buildSystemMeta(points, width, height, padding) {
  if (!points.length) return null;
  const xMin = Math.min(...points.map((p) => p.flowRate));
  const xMax = Math.max(...points.map((p) => p.flowRate));
  const yMin = 0;
  const yMax = Math.max(...points.map((p) => p.totalHead), 1) * 1.12;

  const scaleX = (x) => padding.left + ((x - xMin) / Math.max(xMax - xMin, 1e-12)) * (width - padding.left - padding.right);
  const scaleY = (y) => height - padding.bottom - ((y - yMin) / Math.max(yMax - yMin, 1e-12)) * (height - padding.top - padding.bottom);
  const d = points.map((p, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(p.flowRate)} ${scaleY(p.totalHead)}`).join(' ');
  return { d, scaleX, scaleY, xMin, xMax, yMin, yMax };
}

function tickMarkup(meta, width, height, padding, xTicks = 5, yTicks = 5) {
  const xTickMarkup = Array.from({ length: xTicks + 1 }, (_, index) => {
    const value = meta.xMin + (index / xTicks) * (meta.xMax - meta.xMin);
    const x = meta.scaleX(value);
    return `
      <line x1="${x}" y1="${height - padding.bottom}" x2="${x}" y2="${padding.top}" stroke="${GRID_COLOR}" />
      <text x="${x}" y="${height - 34}" text-anchor="middle" font-size="12" fill="${LABEL_COLOR}">${formatNumber(value, 4)}</text>
    `;
  }).join('');

  const yTickMarkup = Array.from({ length: yTicks + 1 }, (_, index) => {
    const value = meta.yMin + (index / yTicks) * (meta.yMax - meta.yMin);
    const y = meta.scaleY(value);
    return `
      <line x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" stroke="${GRID_COLOR}" />
      <text x="${padding.left - 12}" y="${y + 4}" text-anchor="end" font-size="12" fill="${LABEL_COLOR}">${formatNumber(value, 3)}</text>
    `;
  }).join('');
  return { xTickMarkup, yTickMarkup };
}

function estimateLabelWidth(label) {
  return Math.max(68, String(label || '').length * 6.8 + 18);
}

function clampLabelAnchor(x, y, label, meta) {
  const width = estimateLabelWidth(label);
  const labelX = Math.max(meta.plotLeft + 8, Math.min(x, meta.plotRight - width - 8));
  const labelY = Math.max(meta.plotTop + 8, Math.min(y, meta.plotBottom - 30));
  return { labelX, labelY, width };
}

function markerLabelMarkup({ x, y, label, color, meta, preferredX, preferredY }) {
  const anchor = clampLabelAnchor(preferredX, preferredY, label, meta);
  const lineEndX = anchor.labelX + 8;
  const lineEndY = anchor.labelY + 14;
  return `
    <line x1="${x}" y1="${y}" x2="${lineEndX}" y2="${lineEndY}" stroke="${color}" stroke-width="1.2" opacity="0.48" />
    <rect x="${anchor.labelX}" y="${anchor.labelY}" width="${anchor.width}" height="22" rx="7" fill="white" stroke="${color}" stroke-opacity="0.22" />
    <text x="${anchor.labelX + 9}" y="${anchor.labelY + 15}" font-size="12" fill="#182433">${label}</text>
  `;
}

function renderOperatingPointMarkers(meta, operatingPoints = []) {
  const labelSlots = [
    { dx: 54, dy: 28 },
    { dx: 62, dy: -54 },
    { dx: -150, dy: 30 },
    { dx: -154, dy: -56 },
    { dx: 90, dy: 58 },
    { dx: -178, dy: 58 }
  ];

  return (operatingPoints || [])
    .filter((item) => item.status === 'solved' && Number.isFinite(item.flowRate) && Number.isFinite(item.systemHead))
    .map((item, index) => {
      const x = meta.scaleX(item.flowRate);
      const y = meta.scaleY(item.systemHead);
      const slot = labelSlots[index % labelSlots.length];
      const label = `${item.model} op`;
      const color = item.color || '#7d5ba6';
      return `
        ${markerLabelMarkup({ x, y, label, color, meta, preferredX: x + slot.dx, preferredY: y + slot.dy })}
        <circle cx="${x}" cy="${y}" r="6" fill="${color}" stroke="white" stroke-width="2" />
      `;
    }).join('');
}

export function renderSystemCurveChart(svg, points, dutyPoint, operatingPoints = []) {
  const width = CHART_WIDTH;
  const height = SYSTEM_CHART_HEIGHT;
  const padding = SYSTEM_PADDING;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const meta = buildSystemMeta(points, width, height, padding);

  if (!meta?.d) {
    svg.innerHTML = '';
    return;
  }

  const ticks = tickMarkup(meta, width, height, padding);
  const plotMeta = {
    ...meta,
    plotLeft: padding.left,
    plotRight: width - padding.right,
    plotTop: padding.top,
    plotBottom: height - padding.bottom
  };
  const dutyX = meta.scaleX(dutyPoint.flowRate);
  const dutyY = meta.scaleY(dutyPoint.totalHead);
  const operatingMarkup = renderOperatingPointMarkers(plotMeta, operatingPoints);
  const dutyMarkup = markerLabelMarkup({
    x: dutyX,
    y: dutyY,
    label: 'Duty point',
    color: '#a36a38',
    meta: plotMeta,
    preferredX: dutyX - 142,
    preferredY: dutyY - 58
  });

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="white" rx="18" />
    ${ticks.xTickMarkup}
    ${ticks.yTickMarkup}
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="${AXIS_COLOR}" stroke-width="1.4" />
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${padding.left}" y2="${padding.top}" stroke="${AXIS_COLOR}" stroke-width="1.4" />
    <path d="${meta.d}" fill="none" stroke="#204f74" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
    ${dutyMarkup}
    <circle cx="${dutyX}" cy="${dutyY}" r="6" fill="#a36a38" stroke="white" stroke-width="2" />
    ${operatingMarkup}
    <text x="${width / 2}" y="${height - 18}" text-anchor="middle" font-size="13" fill="#182433">Flow rate, Q (m3/s)</text>
    <text x="24" y="${height / 2}" transform="rotate(-90 24 ${height / 2})" text-anchor="middle" font-size="13" fill="#182433">System head (m)</text>
  `;
}

function buildMultiSeriesMeta(seriesCollection, width, height, padding) {
  const flattened = seriesCollection.flatMap((series) => series.points || []);
  if (!flattened.length) {
    return null;
  }
  const xMin = Math.min(...flattened.map((p) => p.flowRate));
  const xMax = Math.max(...flattened.map((p) => p.flowRate));
  const yMin = 0;
  const yMax = Math.max(...flattened.map((p) => p.value), 1) * 1.12;
  const scaleX = (x) => padding.left + ((x - xMin) / Math.max(xMax - xMin, 1e-12)) * (width - padding.left - padding.right);
  const scaleY = (y) => height - padding.bottom - ((y - yMin) / Math.max(yMax - yMin, 1e-12)) * (height - padding.top - padding.bottom);
  return { xMin, xMax, yMin, yMax, scaleX, scaleY };
}

function seriesPath(points, scaleX, scaleY) {
  return points.map((p, index) => `${index === 0 ? 'M' : 'L'} ${scaleX(p.flowRate)} ${scaleY(p.value)}`).join(' ');
}

function renderMetricMarkers(meta, markers = []) {
  const labelSlots = [
    { dx: 48, dy: 26 },
    { dx: 58, dy: -50 },
    { dx: -136, dy: 30 },
    { dx: -144, dy: -52 },
    { dx: 82, dy: 56 },
    { dx: -166, dy: 56 }
  ];

  return (markers || [])
    .filter((item) => Number.isFinite(item.flowRate) && Number.isFinite(item.value))
    .map((item, index) => {
      const x = meta.scaleX(item.flowRate);
      const y = meta.scaleY(item.value);
      const slot = labelSlots[index % labelSlots.length];
      const color = item.color || '#7d5ba6';
      return `
        ${markerLabelMarkup({ x, y, label: item.label, color, meta, preferredX: x + slot.dx, preferredY: y + slot.dy })}
        <circle cx="${x}" cy="${y}" r="5.5" fill="${color}" stroke="white" stroke-width="2" />
      `;
    }).join('');
}

export function renderPumpMetricChart(svg, seriesCollection, options) {
  const width = CHART_WIDTH;
  const height = METRIC_CHART_HEIGHT;
  const padding = METRIC_PADDING;
  svg.setAttribute('viewBox', `0 0 ${width} ${height}`);
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
  const baseMeta = buildMultiSeriesMeta(seriesCollection, width, height, padding);
  const meta = baseMeta ? {
    ...baseMeta,
    plotLeft: padding.left,
    plotRight: width - padding.right,
    plotTop: padding.top,
    plotBottom: height - padding.bottom
  } : null;
  if (!meta) {
    svg.innerHTML = '';
    return;
  }
  const ticks = tickMarkup(meta, width, height, padding);
  const dutyLine = Number.isFinite(options?.dutyFlowRate) ? `<line x1="${meta.scaleX(options.dutyFlowRate)}" y1="${padding.top}" x2="${meta.scaleX(options.dutyFlowRate)}" y2="${height - padding.bottom}" stroke="#a36a38" stroke-dasharray="6 5" />` : '';
  const seriesMarkup = seriesCollection.map((series, index) => {
    const color = series.color || SERIES_COLORS[index % SERIES_COLORS.length];
    const path = seriesPath(series.points, meta.scaleX, meta.scaleY);
    const dash = series.strokeDasharray ? `stroke-dasharray="${series.strokeDasharray}"` : '';
    return `<path d="${path}" fill="none" stroke="${color}" stroke-width="3" ${dash} />`;
  }).join('');
  const legendMarkup = seriesCollection.map((series, index) => {
    const color = series.color || SERIES_COLORS[index % SERIES_COLORS.length];
    const x = padding.left + (index % 2) * 230;
    const y = 24 + Math.floor(index / 2) * 18;
    return `
      <line x1="${x}" y1="${y}" x2="${x + 24}" y2="${y}" stroke="${color}" stroke-width="3" ${series.strokeDasharray ? `stroke-dasharray="${series.strokeDasharray}"` : ''} />
      <text x="${x + 30}" y="${y + 4}" font-size="11" fill="#182433">${series.label}</text>
    `;
  }).join('');
  const markerMarkup = renderMetricMarkers(meta, options?.markers || []);

  svg.innerHTML = `
    <rect x="0" y="0" width="${width}" height="${height}" fill="white" rx="18" />
    ${ticks.xTickMarkup}
    ${ticks.yTickMarkup}
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${width - padding.right}" y2="${height - padding.bottom}" stroke="${AXIS_COLOR}" stroke-width="1.4" />
    <line x1="${padding.left}" y1="${height - padding.bottom}" x2="${padding.left}" y2="${padding.top}" stroke="${AXIS_COLOR}" stroke-width="1.4" />
    ${dutyLine}
    ${seriesMarkup}
    ${markerMarkup}
    ${legendMarkup}
    <text x="${width / 2}" y="${height - 18}" text-anchor="middle" font-size="13" fill="#182433">Flow rate, Q (m3/s)</text>
    <text x="24" y="${height / 2}" transform="rotate(-90 24 ${height / 2})" text-anchor="middle" font-size="13" fill="#182433">${options?.yLabel || 'Metric'}</text>
  `;
}
