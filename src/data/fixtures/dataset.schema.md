# Test datasets

Each `*.json` file describes one reference run:

| Field | Meaning |
| --- | --- |
| `id` | Stable identifier, also used by the mock device. |
| `label` / `description` | Shown in the app's demo picker. |
| `expectedDiagnoses` | Diagnosis ids the analysis engine must produce. Asserted by `src/analysis/engine.test.ts`. |
| `profile` | Input to `generateRun` (`src/data/synth.ts`). |

The samples are not stored inline. `generateRun` is deterministic, so the seed in
the profile reproduces the exact same trace on every machine and in CI, and the
repository stays small. When real recorded traces become available, add a
`samples` array to a dataset and extend the loader to prefer it; nothing else in
the codebase needs to change.
