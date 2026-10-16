---
description: Run the full verification suite (types, lint, unit tests, specs)
---

Run the project verification suite. Execute the steps in order and stop at the first failure.

1. Types: `npx tsc --noEmit`
2. Lint: `npx eslint`
3. Unit tests: `npx vitest run`
4. Specs: `npx openspec validate --specs`

If `$ARGUMENTS` contains paths, run step 2 targeted (`npx eslint <paths>`) and skip steps not affected by the change; otherwise run the full suite.

On failure: read the output, fix the root cause, and re-run the failed step plus any steps after it. Do not report success until all steps pass.

Finish with a one-line summary:

> ✓ verify: tsc, eslint, vitest, openspec all passing
