## Context

The client management area currently stores a single contact per client (name, phone, email, location, comments) and shows invoice history on the client profile page. There is no mechanism to track sales follow-ups or interactions.

This change adds two new entities — activities and reminders — displayed as a combined timeline on the client profile page.

## Goals / Non-Goals

**Goals:**
- Allow admins to log past interactions (call, email, meeting, note) against a client
- Allow admins to set future follow-up reminders with due dates
- Display all activities and reminders in a single chronological timeline on the client profile page
- Support completing reminders (with visual distinction for completed state)
- Full permission control per module (view/create/edit/delete)

**Non-Goals:**
- Multi-contacts per client (stays as single-contact model)
- Booking/appointments (postponed)
- Agricultural projects/tasks (separate feature)
- Global activity feed across all clients
- Email or notification integration for reminders

## Decisions

- **Combined timeline**: Activities and reminders share one timeline sorted by date. This gives a unified view of past interactions and future commitments.
- **Separate tables**: Rather than a polymorphic approach, activities and reminders are separate tables with different fields (activity has type/subject, reminder has description/due/completed). Simpler schema, clearer semantics.
- **Date-only (no time)**: Both `activity_date` and `remind_at` use `date` type (not timestamp). Sales follow-ups are day-level, not time-of-day.
- **Only today or future dates**: Both activities and reminders must have dates >= today. Past dates are rejected. This prevents accidental backdating.
- **performed_by / created_by**: Tracked as text FK to user. Auto-set from session context. Future-proof for audit trails.
- **Reusing ActionMenu**: Activity items in the timeline reuse the existing ActionMenu pattern for Edit/Delete actions, consistent with client and product tables.
- **Client profile page augmentation**: Rather than a separate route, the Activity section is added to the existing client profile page below client info and above invoice history.

## Risks / Trade-offs

- **Date validation edge case**: Timezone differences could cause off-by-one day issues. Mitigation: compare using UTC dates, ensure consistent timezone handling.
- **No notification for reminders**: Reminders are displayed in the timeline but don't send notifications. This is intentional (out of scope). A future enhancement could add email/in-app notifications.
- **TL;DR**: Activities are append-only in practice (editable but not deleted by non-super). Reminders can be completed but remain visible. This means the timeline data is additive and grows over time. No expected performance issues given typical client volumes.
