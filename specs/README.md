# Specs

Each file is a markdown spec synced to a GitHub issue.

## Commands

```bash
# Pull an issue as a local spec
pnpm spec:pull <issue-number>

# Push local spec changes to GitHub
pnpm spec:push

# Show current active spec
pnpm spec:status
```

## File Format

```markdown
---
number: 3
title: "feat: Create dashboard and navigation"
state: open
url: https://github.com/londonbarrett/alsialabs/issues/3
labels: [bug, enhancement]
assignees: [londonbarrett]
updated: 2026-06-17T00:50:45Z
---

Issue body content here...
```
