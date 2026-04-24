# Pump Selection Workbench

Static browser app for screening-level pump selection with structured case data and auditable hydraulic results.

## Implemented scope

- Refactored case model: `fluid`, `design`, `pump`, `suction`, `discharge`, `pumpCandidates`
- Tahap A: multi-segment hydraulic solver with suction/discharge audit
- Tahap B: NPSHA calculation from suction boundary, vapor pressure, elevation, and suction losses
- Tahap C: pump curve normalization and interpolation
- Tahap D: operating-point solving against the system curve
- Tahap E: screening decision engine for duty fit, NPSH, power, and POR/AOR
- Tahap F: screening viscosity correction for water-basis curves in viscous service
- Tahap G: speed-change and impeller-trim curve scaling through optional candidate fields
- Tahap I: smoke validation coverage for Water, Methanol, and Palm Oil sample cases

## Candidate adjustment fields

Pump candidate JSON can include:

- `targetSpeedRpm` or `adjustedSpeedRpm` for speed scaling
- `targetImpellerDiameter` or `trimmedImpellerDiameter` for impeller trim scaling

Viscosity correction is applied automatically when a water-basis curve is used with a fluid above the screening viscosity threshold. Treat the correction as preliminary until vendor or ANSI/HI project factors are supplied.

## Run

Open `index.html` in a browser. If your browser blocks JavaScript modules from `file://`, serve this folder with any static web server and open the local URL.

## Smoke test

```bash
node src/tests/unit/smoke.test.mjs
```
