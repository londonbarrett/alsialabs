## MODIFIED Requirements

### Requirement: Calendar event data source

Raw data SHALL be served separately from event building:

- `getCalendarRoutines` SHALL return raw routine rows visible to the user (assignee, project owner/co-owner, or superuser) once per page load.
- `getCalendarTasks({ from, to })` SHALL return raw task rows with a due date inside the requested range, visible to the user under the same rule (assignee, project owner/co-owner, or superuser).
- A pure client function (`buildCalendarEvents`) SHALL expand routine occurrences for the visible window, build task events colored with each project's stored color, and hide a routine chip on any day where a task spawned by the same routine is due.

Routine expansion SHALL anchor occurrences to the schedule's own start date (or a fixed epoch when absent) so occurrence days never depend on the queried range. On visible-range change the client SHALL refetch tasks for the padded visible window, clear stale tasks while loading, trigger the global loading bar and the toolbar spinner, and apply only the latest response.

#### Scenario: Tasks with due dates become events

- **GIVEN** a visible task with a due date inside the fetched range
- **WHEN** events are built
- **THEN** the task appears as an event whose color is the stored color of its project

#### Scenario: Task and routine from the same project share one color

- **GIVEN** a task and a routine belonging to the same project
- **WHEN** events are built for both
- **THEN** both events use that project's stored color

#### Scenario: Routine occurrences stay consistent across ranges

- **GIVEN** a recurring routine every N days with a fixed start date
- **WHEN** the user navigates between different months
- **THEN** occurrences land on the same weekdays/days regardless of the queried range

#### Scenario: Routine hidden where its task already exists

- **GIVEN** a routine that spawned a task due on day D
- **WHEN** events for a range containing D are built
- **THEN** the routine chip for day D is hidden and the task chip remains

#### Scenario: Project owners see project tasks

- **GIVEN** a user who owns (or co-owns) a project but is not assigned to its tasks
- **WHEN** the calendar fetches tasks or routines
- **THEN** all of the project's tasks and routines are included

#### Scenario: Stale events cleared during navigation

- **GIVEN** events from the previous range are displayed
- **WHEN** the user navigates to another period
- **THEN** stale events are hidden immediately while the new range loads
- **AND** only the freshly loaded events for that range are shown afterwards
