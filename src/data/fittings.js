export const fittingCatalog = [
  { id: 'elbow_90_standard', label: '90° elbow, standard', k: 0.9 },
  { id: 'elbow_45_standard', label: '45° elbow, standard', k: 0.4 },
  { id: 'gate_valve_open', label: 'Gate valve, fully open', k: 0.15 },
  { id: 'ball_valve_open', label: 'Ball valve, fully open', k: 0.05 },
  { id: 'globe_valve_open', label: 'Globe valve, fully open', k: 10 },
  { id: 'check_valve_swing', label: 'Swing check valve', k: 2 },
  { id: 'entrance_sharp', label: 'Entrance, sharp-edged', k: 0.5 },
  { id: 'exit', label: 'Exit loss', k: 1.0 },
  { id: 'tee_through_run', label: 'Tee through run', k: 0.6 },
  { id: 'tee_branch', label: 'Tee to branch', k: 1.8 },
  { id: 'reducer_gradual', label: 'Reducer, gradual', k: 0.2 },
  { id: 'strainer_clean', label: 'Basket strainer, clean', k: 2.0 }
];

export function getFittingById(id) {
  return fittingCatalog.find((item) => item.id === id) || fittingCatalog[0];
}
