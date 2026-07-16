**NEVER commit or push changes without explicit user permission. Always ask first.**

# Development Workflow

Every feature goes through the OpenSpec lifecycle:

```
Propose → Implement → Archive
```

## Before Starting Any Task

**Always check for available related skills first.** Load the relevant skill using the `skill` tool before beginning work. This ensures you follow project-specific patterns and best practices.

Common triggers:
- **UI components** → load `shadcn`, `tailwind-css-patterns`, `frontend-design`
- **Next.js pages/routes** → load `next-best-practices`, `vercel-react-best-practices`
- **React components** → load `vercel-react-best-practices`, `vercel-composition-patterns`
- **Database/SQL** → load `supabase-postgres-best-practices`
- **Testing** → load `playwright-best-practices`
- **TypeScript types** → load `typescript-advanced-types`
- **Accessibility** → load `accessibility`
- **SEO** → load `seo`
- **Node.js backend** → load `nodejs-best-practices`, `nodejs-backend-patterns`
- **OpenSpec workflow** → load `openspec-propose`, `openspec-apply-change`, `openspec-explore`

## 1. Propose (start here)

Before writing code, create an OpenSpec change:

- **`/opsx-propose`** — Creates a new change with proposal, specs, design, and tasks in one step. Use when you have a clear idea of what to build.
- **`/refine`** — Interactive 4-step wizard that enriches a GitHub issue with structured context (type, scope, acceptance criteria, architecture), pushes to GitHub, then creates OpenSpec artifacts.
- **`/opsx-explore`** — Thinking partner mode. Use when requirements are unclear and you need to explore ideas before committing to a proposal.

All changes live in `openspec/changes/<change-name>/`.

## 2. Implement

Work through the tasks defined in the change:

- **`/opsx-apply`** — Reads the change's tasks and context files, then works through pending tasks one by one. Mark tasks complete as you go. Pause on blockers and ask for clarification.

## 3. Archive

When all tasks are complete:

- **`/opsx-archive`** — Archives the change to `openspec/changes/archive/YYYY-MM-DD-<name>/` and syncs any new or modified specs to the permanent spec tree.

## Spec Tree

`openspec/specs/<capability>/` is the canonical spec library. It persists across all changes.

- Always check existing specs before proposing a new capability to avoid duplication.
- When a change introduces a new capability, the archive step syncs it to the spec tree automatically.
- Specs contain Gherkin scenarios that serve as acceptance criteria and test cases.

Current specs:
- `dashboard-navigation` — Sidebar navigation
- `client-crud` — Client create/edit

## Commands

| Command | Purpose |
|---|---|
| `/opsx-propose` | Create a complete change with all artifacts |
| `/opsx-apply` | Implement tasks from a change |
| `/opsx-archive` | Archive a completed change |
| `/opsx-explore` | Explore mode for thinking through problems |
| `/refine` | Enrich a GitHub issue and create artifacts |
| `/test` | Generate and run Playwright e2e tests |

## Project Conventions

- **Server actions** in `lib/actions/` — auth-guarded, Zod validation, `revalidatePath` after mutations
- **Components** follow shadcn/ui patterns: `FieldGroup`/`Field` for forms, `data-invalid`/`aria-invalid` for validation, `cn()` for class merging
- **Database** via Drizzle ORM with PostgreSQL — schema in `lib/drizzle/schema.ts`
- **Auth** via NextAuth v5 — `auth()` from `@/lib/auth`
- **Icons** from `lucide-react`
- **Toasts** via `sonner`
- **Styling** Tailwind CSS v4 with semantic tokens — no raw colors or manual `dark:` overrides

## Drizzle Migration Workflow

**Always use `drizzle-kit generate`** to create migrations. Never manually edit migration files.

### Rules
1. Make schema changes in `lib/drizzle/schema.ts`
2. Run `npx drizzle-kit generate` — creates SQL + snapshot together
3. Review the generated SQL for issues (NOT NULL without defaults, etc.)
4. Run `npx drizzle-kit migrate` — applies to database
5. Run any data migration scripts if needed

### Never
- Manually edit `drizzle/meta/_journal.json`
- Manually create `.sql` files in `drizzle/`
- Manually create `_snapshot.json` files in `drizzle/meta/`
- Change schema after generating (regenerate if you do)

### Why
Drizzle tracks migration state via snapshot files that must form a chain (`prevId` → `id`). Manual edits break this chain and cause silent failures.
