## Why

Projects are visually indistinguishable from one another, and the calendar currently guesses an event color by hashing the project id — the user has no say in it. Letting owners pick a color for each project makes lists and calendar events recognizable at a glance.

## What Changes

- The `project` table gains a required `color` column (hex string from a fixed 6-color palette)
- A shared palette constant (`components/projects/colors.ts`) replaces the private `TASK_COLORS` array in `lib/calendar/util/events.ts`
- The project dialog gains a required "Color" field: a radio group of 6 color swatches (extracted into `project-color-field.tsx`), validated on the client and with Zod on the server
- Existing projects were backfilled round-robin through the palette per primary owner via a one-off script (run once on dev, then deleted)
- Project cards show the project's color as a dot next to the name; the details card shows a color swatch with its localized name
- Calendar task and routine events use the project's stored color instead of the hash-derived one; `taskColor()` is removed

Colors are NOT unique across projects — any project may reuse any of the 6 colors.

## Capabilities

### New Capabilities

(none)

### Modified Capabilities

- `project-management`: The Project CRUD requirement gains a required color field in the create/edit dialogs, a color dot on list cards, and a color entry in the details card
- `calendar`: The Calendar event data source requirement changes event colors to come from the stored project color instead of being derived deterministically from the project id

## Impact

- `lib/drizzle/schema.ts` — `projectsTable.color` column + generated migrations (0022 adds the column with default; 0023 updates the default to the palette's first color)
- `drizzle/` — generated migrations 0022 and 0023
- `components/projects/colors.ts` — new shared 6-color palette constant
- `lib/actions/projects.ts` — `projectSchema` gains required `color`; all select mappings return it; `upsertProject` persists it
- `lib/types.ts` — `Project`, `CalendarTaskData`, `CalendarRoutineData` gain the project color
- `components/projects/project-form.tsx` — color state/validation; renders the swatch picker
- `components/projects/project-color-field.tsx` — new swatch radiogroup component
- `components/projects/project-card.tsx` — color dot next to project name
- `components/projects/project-details.tsx` — color entry (swatch + localized name) in the details grid
- `lib/actions/calendar.ts`, `lib/actions/tasks.ts` — select the project color for calendar/task rows
- `lib/calendar/util/events.ts` — use stored color; delete `taskColor()`
- `messages/en.json`, `messages/es.json` — add `projects.color`, `projects.colorRequired`, and `projects.colors.*` names
