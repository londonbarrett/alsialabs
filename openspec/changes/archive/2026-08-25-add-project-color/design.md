## Context

Projects (`project` table) have no visual identity; calendar event colors are derived by hashing the project id against a private 6-color array in `lib/calendar/util/events.ts`. The project dialog (`components/projects/project-dialog.tsx` + `project-form.tsx`) serves both create and edit; validation is client-side state + Zod server-side in `upsertProject` (`lib/actions/projects.ts`).

## Goals / Non-Goals

- Goals: owner-chosen required color per project from a fixed 6-color palette; palette shared between projects feature and calendar; stored color drives card dot and calendar events
- Non-Goals: free-form color picking, uniqueness constraints of any kind, recoloring existing UI chrome

## Decisions

### Palette lives in one place
`components/projects/colors.ts` exports `PROJECT_COLORS` as a const tuple plus `ProjectColor = (typeof PROJECT_COLORS)[number]`. Per product decision the palette is: yellow `#eab308`, orange `#f97316`, violet `#8b5cf6`, blue `#3b82f6`, green `#22c55e`, gray `#6b7280` (Tailwind 500 shades). The calendar file imports it; the hash-based `taskColor()` is deleted since every project row has a stored color after backfill.

### Column default + backfill instead of nullable
`color text NOT NULL DEFAULT <first palette color>` keeps the generated migration valid on non-empty tables without hand-editing SQL (0022 added the column with the original default; 0023 updated the default when the palette changed). The app always passes `color` explicitly, so the default is only a migration safety net. A one-off script (since removed) reassigned round-robin through the palette per primary owner ordered by `createdAt`, so each owner's projects get a varied spread; dev data was backfilled before its deletion. No unique index — colors may repeat freely.

### Validation mirrors existing patterns
- Client: form keeps a `color: string | undefined` state; `validate()` reports `projects.colorRequired` when unset; the swatch group follows the same markup contract as other fields (`data-invalid` on wrapper, `aria-invalid`/`aria-checked` on swatches, `role="alert"` error paragraph).
- Server: `z.enum(PROJECT_COLORS)` makes it required at the type level too; `ProjectFormData.color` becomes `ProjectColor`.

### Swatch UI
Extracted into `components/projects/project-color-field.tsx` to keep the form lean. A `role="radiogroup"` labelled via `projects.color`; each swatch is a `type="button"` with `role="radio"`, background set inline from the hex value (palette colors are data, not theme tokens), selection shown with a ring, accessible name from `projects.colors.<name>` i18n keys.

### Display surfaces
- Project list card: color dot inline before the project name
- Details card: a grid entry after Category showing the swatch plus the localized color name (falls back to the raw hex if the value is outside the palette); grid order is owner, category, color, location, start date, end date, budget, description

## Risks / Trade-offs

- [Hardcoded hexes bypass semantic tokens] → acceptable: these are entity attribute values (like user avatars), not UI theme colors; they must render identically in light/dark.
- [Backfill repeats colors within an owner beyond 6 projects] → accepted: no uniqueness requirement.
- [Calendar rows now carry `color`] → tiny payload increase; queries already join `projectsTable`.
