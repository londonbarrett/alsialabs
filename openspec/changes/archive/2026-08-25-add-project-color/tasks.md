## 1. Schema & backfill

- [x] 1.1 Create `components/projects/colors.ts` exporting `PROJECT_COLORS`, `ProjectColor`, and `PROJECT_COLOR_NAME_KEYS` — palette per product decision: yellow, orange, violet, blue, green, gray (Tailwind 500 shades; originally the calendar's `TASK_COLORS`, later replaced)
- [x] 1.2 Add `color: text().notNull().default(PROJECT_COLORS[0])` to `projectsTable` in `lib/drizzle/schema.ts`
- [x] 1.3 Run `npx drizzle-kit generate`, review the generated SQL, then `npx drizzle-kit migrate` (0022 adds the column; 0023 updates the default after the palette change)
- [x] 1.4 Backfill existing rows: ran a one-off script assigning palette colors round-robin per primary owner (ordered by `createdAt`); script deleted after use since dev data is migrated

## 2. Server actions & types

- [x] 2.1 In `lib/actions/projects.ts`, add required `color: z.enum(PROJECT_COLORS)` to `projectSchema` and persist it in `upsertProject` (insert + update)
- [x] 2.2 Add `color` to the explicit select mappings in `getProjects`, `getProjectsWithDetails`, `getProjectById`, and `getProjectForEdit`
- [x] 2.3 Add `color` to the `Project` type in `lib/types.ts`

## 3. Project form & dialog

- [x] 3.1 Add a required color state + validation (`projects.colorRequired`) to `components/projects/project-form.tsx`
- [x] 3.2 Render a `role="radiogroup"` of 6 swatches following the existing field pattern (`data-invalid`, `aria-invalid`, `role="alert"`), pre-filled when editing — extracted into `components/projects/project-color-field.tsx`
- [x] 3.3 Include `color` in the submit payload to `upsertProject`

## 4. Project card display

- [x] 4.1 Show a color dot next to the project name in `components/projects/project-card.tsx`
- [x] 4.2 Show a color swatch with localized color name in the details grid of `components/projects/project-details.tsx`

## 5. Calendar integration

- [x] 5.1 Refactor `lib/calendar/util/events.ts`: delete the local `TASK_COLORS` array and `taskColor()` (nothing else imports it, so no palette import is needed there)
- [x] 5.2 Add `color` to the task/routine selects in `lib/actions/calendar.ts` and to `getMyTasks` in `lib/actions/tasks.ts` (the calendar page's task source); add `projectColor` to `CalendarTaskData`/`CalendarRoutineData` in `lib/types.ts`
- [x] 5.3 Use `task.projectColor` / `routine.projectColor` for event colors in `events.ts`

## 6. i18n

- [x] 6.1 Add `projects.color`, `projects.colorRequired`, and `projects.colors.*` swatch names to `messages/en.json`
- [x] 6.2 Mirror the same keys in `messages/es.json`

## 7. Verification

- [x] 7.1 Run typecheck and lint; fix errors
- [x] 7.2 Manually verify: create without color shows a required error; create/edit with a color persists it; card shows the dot; calendar events render the chosen color
