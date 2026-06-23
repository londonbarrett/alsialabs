## Context

Brand new "Clients" feature area. No client data exists in the system today. The app uses Next.js App Router with Drizzle ORM (PostgreSQL), Auth.js for authentication, and ShadCN UI components. Existing schema follows Auth.js adapter conventions at `lib/drizzle/schema.ts`. Sidebar navigation is configured via `config/sidebar-menu.json`.

## Goals / Non-Goals

**Goals:**
- Provide a CSV-based import flow for existing client records
- Display imported clients in an accessible table at `/dashboard/clients`
- Prevent duplicate imports using phone number as unique identifier

**Non-Goals:**
- Client-side CSV parsing or file persistence
- Table filtering, sorting, or pagination
- Real row actions (View / Edit / Delete are dummy toasts only)
- User-to-client relationship mapping (all `user_id` values are null)

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Import mechanism | Server Action | Co-located with page, built-in FormData handling, automatic path revalidation via `revalidatePath`, idiomatic Next.js App Router pattern |
| File storage | Not persisted | CSV data is parsed and discarded after insertion; only database records are stored |
| Unique identifier | Phone number | Simple deduplication; no existing client ID system |
| PK type | UUID (auto-generated) | Consistent with existing `user.id` pattern using `crypto.randomUUID()` |
| Data fetching | Server Component | Default Next.js behavior; client list rendered on the server, no client-side fetching needed |
| Table component | ShadCN Table | Consistent with existing UI component library; needs `npx shadcn@latest add table` |

## Risks / Trade-offs

- **CSV validation**: If columns are missing or malformed, the entire import fails. No partial-import recovery. → Mitigation: validate headers before processing rows; return clear error messages.
- **Phone deduplication**: Phone is treated as unique, but the schema only enforces this at the application level (not a DB unique constraint as specified). → Consider adding a unique constraint if duplicate prevention must be guaranteed.
- **Single-user assumption**: All `user_id` values are null now. If multi-user client isolation is needed later, a migration will be required.
- **Toast feedback**: Error toasts disappear automatically; critical errors could be missed. → Acceptable for this use case given expected low error frequency.
