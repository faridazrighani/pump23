export function populateSelect(selectElement, items, selectedId) {
  selectElement.innerHTML = items.map((item) => `<option value="${item.id}">${item.label}</option>`).join('');
  if (selectedId) {
    selectElement.value = selectedId;
  }
}
