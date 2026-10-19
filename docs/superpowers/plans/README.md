# Plans

Implementation plans for Alsia, written by the superpowers `writing-plans` skill.

Each plan is a dated markdown file: `YYYY-MM-DD-<topic>-plan.md`. Plans break approved design docs (`../specs/`) into bite-sized tasks with exact file paths, complete code, and verification steps.

## Workflow

1. **Brainstorm** → design doc in `../specs/`
2. **Write plan** → dated file in this directory
3. **Execute** → inline (`executing-pls`) or subagent-driven (`subagent-driven-development`)
4. **Verify** → `pnpm verify` (typecheck + lint + tests)
5. **Commit** → pre-commit hook enforces `pnpm verify`
