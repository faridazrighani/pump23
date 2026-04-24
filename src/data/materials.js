export const materialPresets = [
  { id: 'commercial_steel', label: 'Commercial steel', roughness: 0.000045 },
  { id: 'carbon_steel_new', label: 'Carbon steel, new', roughness: 0.000045 },
  { id: 'stainless_steel', label: 'Stainless steel, smooth', roughness: 0.000015 },
  { id: 'drawn_tubing', label: 'Drawn tubing', roughness: 0.0000015 },
  { id: 'cast_iron', label: 'Cast iron', roughness: 0.00026 }
];

export function getMaterialPresetById(id) {
  return materialPresets.find((item) => item.id === id) || materialPresets[0];
}
