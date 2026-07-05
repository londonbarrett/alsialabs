## 1. Database Schema

- [x] 1.1 Add `activitiesTable` to `lib/drizzle/schema.ts` with columns: id, client_id, type, subject, description, activity_date, performed_by, created_at, updated_at
- [x] 1.2 Add `remindersTable` to `lib/drizzle/schema.ts` with columns: id, client_id, description, remind_at, completed, completed_at, created_by, created_at, updated_at
- [x] 1.3 Export Activity and Reminder types from schema
- [x] 1.4 Run `drizzle-kit generate` to create migration SQL
- [x] 1.5 Run `drizzle-kit migrate` to apply migration
- [x] 1.6 Add `activities` and `reminders` module permissions to seed script
- [x] 1.7 Re-run seed to populate new permissions for super and admin roles

## 2. Server Actions — Activities

- [x] 2.1 Create `lib/actions/activities.ts` with Zod schemas for activity validation (type enum, subject required, date >= today, sanitization)
- [x] 2.2 Implement `getActivities(clientId)` — fetch activities for a client, require `activities:view`
- [x] 2.3 Implement `upsertActivity(data, activityId?)` — create/update activity with permission check (create/edit), validation, date check, revalidatePath
- [x] 2.4 Implement `deleteActivity(activityId)` — delete activity, require super user or `activities:delete`, with revalidatePath

## 3. Server Actions — Reminders

- [x] 3.1 Create `lib/actions/reminders.ts` with Zod schemas for reminder validation (description required, remind_at >= today, sanitization)
- [x] 3.2 Implement `getReminders(clientId)` — fetch reminders for a client, require `reminders:view`
- [x] 3.3 Implement `upsertReminder(data, reminderId?)` — create/update reminder with permission check (create/edit), validation, date check, revalidatePath
- [x] 3.4 Implement `completeReminder(reminderId)` — mark reminder as completed, require `reminders:complete`, set completed_at
- [x] 3.5 Implement `deleteReminder(reminderId)` — delete reminder, require `reminders:delete`, with revalidatePath

## 4. UI Components — Activity

- [x] 4.1 Create `components/clients/log-activity-dialog.tsx` — dialog form with type pills (call/email/meeting/note), subject, description, date picker, loading state, validation
- [x] 4.2 Create `components/clients/activity-item.tsx` — single activity display row with icon per type, subject, description, date, performer, and action menu (edit/delete)

## 5. UI Components — Reminder

- [x] 5.1 Create `components/clients/reminder-dialog.tsx` — dialog form with description and due date, loading state, validation
- [x] 5.2 Create `components/clients/reminder-item.tsx` — single reminder display with description, due date, completed state styling, complete action, and action menu (edit/delete)

## 6. Activity Timeline Component

- [x] 6.1 Create `components/clients/activity-timeline.tsx` — combined list of activities and reminders sorted by date descending
- [x] 6.2 Interleave activities and reminders in a single timeline with consistent styling
- [x] 6.3 Add "Log Activity" and "Add Reminder" buttons above the timeline
- [x] 6.4 Handle empty state (no activities or reminders yet)

## 7. Client Profile Page

- [x] 7.1 Update `app/dashboard/clients/[clientId]/page.tsx` to fetch activities and reminders data alongside client info
- [x] 7.2 Add permissions check for `activities:view` and `reminders:view`
- [x] 7.3 Render Activity section between client info and invoice history
- [x] 7.4 Pass permissions to activity-timeline component for action visibility
- [x] 7.5 Verify page layout renders correctly (info → activity → invoices)

## 8. Verification

- [x] 8.1 Run `npm run build` to check for type errors
- [x] 8.2 Run `npm run lint` to check for lint issues
- [ ] 8.3 Test activity CRUD flow: create, edit, delete via UI
- [ ] 8.4 Test reminder flow: create, edit, complete, delete via UI
- [ ] 8.5 Test date validation: past dates are rejected on client and server
- [ ] 8.6 Test permission gating: verify buttons/actions hidden without appropriate permissions
- [ ] 8.7 Test timeline ordering: items sorted by date descending
