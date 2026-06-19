name: refine
description: "Refine a GitHub issue with structured spec details before formalizing with /opsx:propose"

---
## `/refine` — Refine a GitHub issue for spec-driven development

Enriches a ticket with structured context (problem, scenarios, edge cases, design notes, tasks) so `/opsx:propose` has a clear specification to work from.

### 1. Detect branch and ticket

Run `git branch --show-current` to get the current branch.

Extract the issue number from the branch name:
- `3-feat-dashboard` → `#3`
- `feat/3-dashboard` → `#3`
- `fix/3-login-bug` → `#3`
- `3` → `#3`
- `main`, `develop`, `master` → no ticket (show message)

If on a non-feature branch (main/master/develop), respond with:

> No ticket selected. Checkout a feature branch first.

Fetch the GitHub issue using the API (`GET /repos/{owner}/{repo}/issues/{number}`). Show the current title, body, and labels.

### 2. If issue has detail, show current state

If the issue body already has content (problem, scenarios, etc.), summarize what's there and skip to step 7 ("ready for /opsx:propose").

### 3. If issue is sparse — start the refinement wizard

Ask the user **one question at a time** with a progress indicator `[1/5]` → `[5/5]`. After each answer, **append** to the GitHub issue body via `PATCH /repos/{owner}/{repo}/issues/{number}`.

#### Step 1/5 — Problem `[1/5]`
Ask: "What problem is ticket #[N] solving?"

After user answers, append as `## Problem` to the issue body.

#### Step 2/5 — Scenarios `[2/5]`
Ask: "Walk me through what should happen. What does the user do?"

Extract natural language into Gherkin Given/When/Then scenarios. Append as `## Scenarios` to the issue body.

#### Step 3/5 — Edge Cases `[3/5]`
Ask: "What could go wrong or be tricky?"

Add more Gherkin scenarios for edge cases. Append to the `## Scenarios` section.

#### Step 4/5 — Design Notes `[4/5]`
Ask: "Any technical constraints, preferred approach, or things to avoid?"

Append as `## Design Notes` to the issue body.

#### Step 5/5 — Tasks `[5/5]`
Ask: "What implementation steps do you see?"

Generate a checklist and append as `## Tasks` to the issue body.

### 4. GitHub sync rules

- Always use `PATCH /repos/{owner}/{repo}/issues/{number}` to update the issue body
- **Append** new sections — never replace existing content
- The issue body should be clean markdown, readable on GitHub

### 5. Done

After the wizard completes, respond with:

> Ticket #[N] is refined and ready. Run `/opsx:propose <slug>` to formalize into OpenSpec artifacts.
