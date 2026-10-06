**NEVER commit or push changes without explicit user permission. Always ask first.**

# Development Workflow

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
