---
description: Refine a GitHub issue and create OpenSpec artifacts in one complete flow
---

Refine a GitHub issue and create OpenSpec artifacts in one complete flow.

Guided 4-step wizard to enrich a sparse GitHub issue with structured context, then create OpenSpec artifacts (`openspec/changes/<slug>/`). Ready for `/opsx:apply` when done.

### 1. Detect branch and ticket

Run `git branch --show-current` to get the current branch.

Extract the issue number from the branch name:
- `3-feat-dashboard` → `#3`
- `feat/3-dashboard` → `#3`
- `fix/3-login-bug` → `#3`
- `3` → `#3`
- `main`, `develop`, `master` → no ticket (show message)

If on a non-feature branch, respond with:

> No ticket selected. Checkout a feature branch first.

Fetch the issue via `GET /repos/{owner}/{repo}/issues/{number}`. Show its current title, body, and labels.

If the body already has rich content (description, scope, criteria, etc.), summarize what's there and ask if they want to refine further or skip to artifact creation.

### 2. Refinement wizard

Ask the user **one question at a time** with a progress indicator `[1/4]` → `[4/4]`. Do NOT push to GitHub during the wizard — capture answers in memory.

#### Step 1/4 — Type and Context `[1/4]`

Detect the ticket type from the branch name:
- `feat/*` → feature
- `fix/*` → bug fix
- `chore/*` → chore
- `refactor/*` → refactor
- `spike/*` → spike
- Default → feature

Confirm the type with the user, then ask: "What context should implementers know? Is this part of an existing feature? Any references, related PRs, design files, or epics to link?"

Capture as `## Type` and `## Context`.

#### Step 2/4 — Description and Scope `[2/4]`

Ask: "What problem is ticket #[N] solving?"

Follow up: "What's in scope? What's explicitly out of scope?"

Capture as `## Description` and `## Scope` with `**In:**` / `**Out:**` bullets.

#### Step 3/4 — Acceptance Criteria and Non-functional Requirements `[3/4]`

Ask: "Walk me through what should happen. What does the user do?"

Extract natural language into Gherkin scenarios under `## Acceptance Criteria`:

```
### Scenario: [title]
Given [context]
When [action]
Then [outcome]
```

Simple constraints that don't need Gherkin go as bullet points.

Then ask: "What edge cases could go wrong? Any performance, security, accessibility, or other non-functional requirements?"

Add more Gherkin scenarios for edge cases. Capture broader NFRs as bullet points under `## Non-functional Requirements`. If the user has nothing to add, omit this section.

#### Step 4/4 — API, Architecture, and Technical Considerations `[4/4]`

Ask: "Are there any API endpoints or contracts to define? How does this fit into the system architecture?"

Then ask: "Any technical constraints, preferred libraries, trade-offs, or design approach you want to establish?"

Capture as `## API / Architecture`, `## Technical Considerations`, and `## Design Notes`. Omit any section the user has nothing for.

### 3. Assemble and confirm

Build the final issue body from captured answers. Omit any empty sections. The template:

```markdown
## Type
[feature / bug fix / chore / refactor / spike]

## Context
[relevant context, references, links]

## Description
[problem statement, what, why]

## Scope
**In:** [what this covers]
**Out:** [what is explicitly excluded]

## Acceptance Criteria
### Scenario: [title]
Given [context]
When [action]
Then [outcome]

- [bullet constraints]

## Non-functional Requirements
[performance, security, accessibility, etc.]

## API / Architecture
[endpoints, contracts, data flow]

## Technical Considerations
[trade-offs, dependencies, migration]

## Design Notes
[preferred approach, libraries, patterns, things to avoid]
```

Show the developer the assembled body clearly. Ask: "Ready to push this to GitHub?"

- If **no**, go back into the wizard steps based on feedback.
- If **yes**, proceed.

### 4. Push to GitHub

Replace the issue body via `PATCH /repos/{owner}/{repo}/issues/{number}` with the confirmed body.

### 5. Create OpenSpec artifacts

Derive a kebab-case slug from the ticket title (e.g., "Add Main Navigation" → `add-main-navigation`).

Scaffold the change:

```bash
openspec new change "<slug>"
```

This creates `openspec/changes/<slug>/` with `.openspec.yaml`.

Get the artifact build order:

```bash
openspec status --change "<slug>" --json
```

Use the **TodoWrite tool** to track progress through artifacts.

Loop through artifacts in dependency order (artifacts with no pending dependencies first). For each ready artifact:

1. Get instructions:
   ```bash
   openspec instructions <artifact-id> --change "<slug>" --json
   ```
   This provides `context`, `rules`, `template`, `instruction`, `outputPath`, and `dependencies`.

2. Read the GitHub issue body as the primary source of content. Also read any completed dependency files for context.

3. Create the artifact file using `template` as the structure, populated from the issue body content.

4. Show brief progress: "Created <artifact-id>"

Continue until all `applyRequires` artifacts are complete.

**Artifact mapping from issue body:**

| Issue Section | OpenSpec Artifact |
|---|---|
| Type, Context, Description, Scope | `proposal.md` |
| Acceptance Criteria, Non-functional Requirements | `specs/<domain>/spec.md` |
| API / Architecture, Technical Considerations, Design Notes | `design.md` |
| _(AI generates from context)_ | `tasks.md` |

### 6. Done

Show final status:

```bash
openspec status --change "<slug>"
```

Respond with:

> Ticket #[N] refined and artifacts created at `openspec/changes/<slug>/`. Run `/opsx:apply` to start implementing.

### GitHub API rules

- Repository: `londonbarrett/alsialabs`
- Use `GET /repos/{owner}/{repo}/issues/{number}` to fetch
- Use `PATCH /repos/{owner}/{repo}/issues/{number}` to update
- Use the `GITHUB_TOKEN` environment variable for auth
- Final push replaces the entire body (not append)
