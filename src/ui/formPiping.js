import { fittingCatalog } from '../data/fittings.js';
import { formatFixed } from '../core/units.js';

function fittingOptionsMarkup(selectedId) {
  return fittingCatalog.map((item) => `<option value="${item.id}" ${item.id === selectedId ? 'selected' : ''}>${item.label}</option>`).join('');
}

function segmentIndexOptionsMarkup(segmentCount, selectedIndex = 0) {
  return Array.from({ length: Math.max(segmentCount, 1) }, (_, index) => `
    <option value="${index}" ${index === selectedIndex ? 'selected' : ''}>Segment ${index + 1}</option>
  `).join('');
}

export function createSegmentRow(container, segment, onRemove) {
  const row = document.createElement('div');
  row.className = 'row-grid segment-row';
  row.innerHTML = `
    <input data-field="name" value="${segment.name || ''}" placeholder="Segment name" />
    <input data-field="diameter" type="number" min="0" step="any" value="${segment.diameter ?? ''}" />
    <input data-field="length" type="number" min="0" step="any" value="${segment.length ?? ''}" />
    <input data-field="roughness" type="number" min="0" step="any" value="${segment.roughness ?? ''}" />
    <button type="button" class="remove-btn">Remove</button>
  `;
  row.querySelector('.remove-btn').addEventListener('click', () => {
    row.remove();
    onRemove?.();
  });
  container.appendChild(row);
  return row;
}

export function refreshFittingSegmentOptions(container, segmentCount) {
  Array.from(container.children).forEach((row) => {
    const select = row.querySelector('select[data-field="segmentIndex"]');
    if (!select) return;
    const currentIndex = Number(select.value) || 0;
    select.innerHTML = segmentIndexOptionsMarkup(segmentCount, Math.min(currentIndex, Math.max(segmentCount - 1, 0)));
  });
}

export function createFittingRow(container, fitting, segmentCount = 1, onRemove) {
  const selectedSegment = Number.isInteger(fitting.segmentIndex) ? fitting.segmentIndex : 0;
  const row = document.createElement('div');
  row.className = 'row-grid fitting-row';
  row.innerHTML = `
    <select data-field="id">${fittingOptionsMarkup(fitting.id)}</select>
    <select data-field="segmentIndex">${segmentIndexOptionsMarkup(segmentCount, selectedSegment)}</select>
    <input data-field="count" type="number" min="0" step="1" value="${fitting.count ?? 1}" />
    <input data-field="k" type="number" min="0" step="any" value="${fitting.k ?? 0}" />
    <div class="k-subtotal" data-role="subtotal">${formatFixed((fitting.count || 0) * (fitting.k || 0), 4)}</div>
    <button type="button" class="remove-btn">Remove</button>
  `;

  const select = row.querySelector('select[data-field="id"]');
  const countInput = row.querySelector('input[data-field="count"]');
  const kInput = row.querySelector('input[data-field="k"]');
  const subtotal = row.querySelector('[data-role="subtotal"]');

  function refreshFromCatalog() {
    const catalogItem = fittingCatalog.find((item) => item.id === select.value);
    if (catalogItem) {
      kInput.value = catalogItem.k;
    }
    refreshSubtotal();
  }

  function refreshSubtotal() {
    const count = Number(countInput.value) || 0;
    const k = Number(kInput.value) || 0;
    subtotal.textContent = formatFixed(count * k, 4);
  }

  select.addEventListener('change', refreshFromCatalog);
  countInput.addEventListener('input', refreshSubtotal);
  kInput.addEventListener('input', refreshSubtotal);
  row.querySelector('.remove-btn').addEventListener('click', () => {
    row.remove();
    onRemove?.();
  });

  container.appendChild(row);
  return row;
}

export function readSegmentRows(container) {
  return Array.from(container.children).map((row, index) => ({
    name: row.querySelector('[data-field="name"]').value || `Segment-${index + 1}`,
    diameter: Number(row.querySelector('[data-field="diameter"]').value),
    length: Number(row.querySelector('[data-field="length"]').value),
    roughness: Number(row.querySelector('[data-field="roughness"]').value)
  }));
}

export function readFittingRows(container) {
  return Array.from(container.children).map((row) => {
    const select = row.querySelector('[data-field="id"]');
    const label = select.options[select.selectedIndex]?.textContent || select.value;
    return {
      id: select.value,
      name: label,
      segmentIndex: Number(row.querySelector('[data-field="segmentIndex"]').value),
      count: Number(row.querySelector('[data-field="count"]').value),
      k: Number(row.querySelector('[data-field="k"]').value)
    };
  });
}

export function populateSegmentIndexSelect(select, segmentCount, selectedIndex = 0) {
  if (!select) return;
  select.innerHTML = segmentIndexOptionsMarkup(segmentCount, selectedIndex);
}
