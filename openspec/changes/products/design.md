## Context

Currently the app manages clients via a CRUD module. Products is a new domain requiring a providers table for source tracking. The design follows the existing patterns: server actions, Drizzle ORM, shadcn/ui dialogs and forms, and permission-based access control.

## Goals / Non-Goals

**Goals:**
- Database schema for providers and products
- Full CRUD for products via server actions
- Products UI (table, add/edit dialog, action menu)
- Permission enforcement (view, create, edit, delete)
- Seed company provider and products module permissions

**Non-Goals:**
- Providers CRUD UI (providers are managed implicitly via seeding)
- Inventory management
- CSV import

## Decisions

| Decision | Choice | Rationale |
|---|---|---|
| Provider reference instead of type field | `provider_id` FK on products | In-house products reference a seeded company provider; external products reference a different provider. No separate `type` enum needed. |
| No active flag on products | Omitted | Not required for current scope. Can be added later if needed. |
| Follow clients module pattern | Same component structure, server action pattern, permission model | Reduces learning curve, enables code reuse, consistent UX |
| Snake case columns | `provider_id`, `contact_name`, etc. | Matches existing Drizzle conventions in the schema |
| Server actions only, no REST API | Same as clients module | Simple enough for the current scope; no external consumers |

## Risks / Trade-offs

- **No provider CRUD UI** → Providers must be managed via seed data or direct DB. If provider needs grow, a full providers UI would need to be added.
- **No CSV import** → Users must add products one-by-one through the dialog. Bulk operations deferred to future scope.
- **Deleting products with references** → Must check for references before allowing deletion (handled in the delete action).
