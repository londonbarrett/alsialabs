---
description: Run the full verification suite (types, lint, unit tests with coverage)
---

Run the project verification suite. Execute the steps in order and stop at the first failure.

1. `pnpm verify` — runs typecheck, lint (warnings fail), and unit tests with coverage thresholds

If `$ARGUMENTS` contains paths, run lint targeted (`pnpm eslint <paths>`) and skip steps not affected by the change; otherwise run the full suite.

On failure: read the output, fix the root cause, and re-run the failed step plus any steps after it. Do not report success until all steps pass.

Finish with a one-line summary:

> ✓ verify: tsc, eslint, vitest all passing
