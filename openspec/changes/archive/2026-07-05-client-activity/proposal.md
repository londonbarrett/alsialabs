## Why

Sales team needs to track client interactions and set follow-up reminders to improve customer service and conversion rates. Currently there is no way to log calls, emails, meetings, or notes against a client, nor to set future follow-up reminders. This makes it hard to keep track of conversations and commitments.

## What Changes

- New `activity` database table for logging past interactions (call, email, meeting, note) with subject, description, date, and performer
- New `reminder` database table for future follow-ups with description, due date, and completion tracking
- New server actions in `lib/actions/activities.ts` and `lib/actions/reminders.ts`
- New UI components: activity timeline, activity dialog, reminder dialog
- Client profile page gets an "Activity" section combining activities and reminders in a single timeline
- New permissions: `activities` module (view/create/edit/delete) and `reminders` module (view/create/edit/complete/delete)
- Seed new permissions for super and admin roles

## Capabilities

### New Capabilities
- `client-activity`: Sales follow-up tracking with activity log and reminders, displayed as a timeline on the client profile page

### Modified Capabilities
- `client-crud`: Client profile page gains a new Activity section with timeline, log activity, and reminder functionality

## Impact

- **Schema**: Two new tables in `lib/drizzle/schema.ts` — `activitiesTable` and `remindersTable`
- **Server actions**: New files `lib/actions/activities.ts` and `lib/actions/reminders.ts`
- **Components**: New components under `components/clients/` — `activity-timeline.tsx`, `log-activity-dialog.tsx`, `reminder-dialog.tsx`
- **Client profile page**: `app/dashboard/clients/[clientId]/page.tsx` updated to include the Activity section
- **Permissions seed**: Updated to include `activities` and `reminders` modules
- **No breaking changes** to existing client or invoice models
