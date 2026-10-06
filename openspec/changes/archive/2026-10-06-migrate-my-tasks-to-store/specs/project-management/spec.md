## MODIFIED Requirements

### Requirement: Task comments

The system SHALL allow project members (owners and collaborators) and task assignees to have conversations on tasks. Comments are displayed in a slide-over Sheet panel. Only the comment author or project owners can delete comments. Only the comment author can edit their own comments. Comment operations (add, edit, delete) use optimistic updates with the global loading indicator during server requests and success toasts on completion. Comments live in the page's own store keyed by task id — the project tasks store on the project subpage, the my-tasks store on the My Tasks page — and are loaded when the panel opens. A comment mutation SHALL adjust the owning task's `commentCount` in the same action, so a rejected comment rolls its count back with it and the count cannot drift from the list; loading comments SHALL reconcile `commentCount` to the fetched length. The comments slide-over is a single dumb presentational component, `TaskCommentsSheet` `components/common/task-comments-sheet.tsx`, which takes comments plus callbacks and owns only the draft text, which comment is being edited, and scroll position. Each domain supplies its own controller over it — `ProjectTaskCommentsPanel` and `MyTaskCommentsPanel`, at `components/projects/project-task-comments-panel.tsx` and `components/my-tasks/my-task-comments-panel.tsx` — each reading and writing its own store, so the markup exists once while loading, fetching and mutations stay per domain. Neither controller reports count changes upward through a callback: the count moves with the comment in the store action.


#### Scenario: Assignee who is not a project member can comment

- **GIVEN** a user who is assigned to a task but is not an owner or collaborator of the project
- **WHEN** the user opens the comments panel for that task from My Tasks
- **THEN** the comments are loaded and shown
- **AND** the user can add comments
- **AND** the user can edit their own comments
- **AND** the user can delete their own comments

#### Scenario: Open comments panel via button

- **GIVEN** a user viewing the task table
- **WHEN** the user clicks the comment count button on a task row
- **THEN** the comments panel opens as a slide-over Sheet

#### Scenario: Open comments panel via double-click

- **GIVEN** a user viewing the task table
- **WHEN** the user double-clicks anywhere on a task row
- **THEN** the comments panel opens as a slide-over Sheet

#### Scenario: Comments panel header layout

- **GIVEN** a user with the comments panel open
- **WHEN** the panel header is displayed
- **THEN** the task name is shown as the title
- **AND** the task description is shown below as muted text

#### Scenario: View comments

- **GIVEN** a user with the comments panel open
- **WHEN** the panel loads
- **THEN** existing comments are displayed in chronological order
- **AND** each comment shows the author's avatar, name, relative timestamp, and content
- **AND** if the comment has been edited, "(edited)" is shown after the timestamp

#### Scenario: Add a comment

- **GIVEN** a user with the comments panel open
- **WHEN** the user types a comment and clicks Send (or presses Enter)
- **THEN** the comment appears immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the comment was added
- **AND** the comment count on the task row increments

#### Scenario: Edit own comment in place

- **GIVEN** a user viewing a comment they authored
- **WHEN** the user hovers over the comment
- **THEN** a pencil (edit) icon appears
- **WHEN** the user clicks the edit icon
- **THEN** the comment content becomes an editable textarea
- **AND** Save and Cancel buttons appear below the textarea
- **WHEN** the user modifies the content and clicks Save (or presses Enter)
- **THEN** the comment is updated immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the comment was updated
- **AND** "(edited)" appears in the timestamp
- **WHEN** the user clicks Cancel (or presses Escape)
- **THEN** the edit is discarded and the original content is shown

#### Scenario: Cannot edit other users' comments

- **GIVEN** a user viewing a comment authored by another user
- **WHEN** the user hovers over the comment
- **THEN** the edit icon is not shown

#### Scenario: Delete own comment (author)

- **GIVEN** a user viewing a comment they authored
- **WHEN** the user hovers over the comment
- **THEN** a trash (delete) icon appears
- **WHEN** the user clicks the delete icon
- **THEN** the comment is removed immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the comment was deleted
- **AND** the comment count on the task row decrements

#### Scenario: Owner deletes any comment

- **GIVEN** a user who is an owner of the project
- **WHEN** the user hovers over any comment
- **THEN** a trash (delete) icon appears
- **WHEN** the user clicks the delete icon
- **THEN** the comment is deleted

#### Scenario: Collaborator cannot delete others' comments

- **GIVEN** a user who is a collaborator (not an owner) of the project
- **WHEN** the user hovers over a comment authored by another user
- **THEN** the delete icon is not shown

#### Scenario: Refresh comments

- **GIVEN** a user with the comments panel open
- **WHEN** the user clicks the refresh button in the panel header
- **THEN** the comments list is re-fetched from the server
- **AND** a loading spinner is shown during the fetch

#### Scenario: Rejected comment does not drift the count

- **WHEN** a comment mutation is rejected by the server
- **THEN** the pending comment and its `commentCount` increment are discarded together
- **AND** the list shows the count as it was before the attempt

#### Scenario: Comment count updates without reaching the parent

- **WHEN** a comment is added, edited, or deleted from the My Tasks comments panel
- **THEN** `commentCount` updates in the my-tasks store action
- **AND** `MyTasksList` receives no `onCommentCountChange` callback

### Requirement: My Tasks page

The system SHALL provide a "My Tasks" page accessible from the sidebar that shows all tasks assigned to the current user across all projects they have access to. Tasks are held in a page-scoped store `MyTasksProvider` mounted by `app/app/mis-tareas/page.tsx`, seeded from `getMyTasks({})`. Status changes use optimistic updates with global loading indicator and success toasts. Each row shows a Due Date column; tasks that are not "done" or "cancelled" with a due date in the past show an "Overdue" badge. The status filter includes "cancelled". Cancelled tasks are read-only for non-owners.

The status and project filters are client-side projections over the full task set in the store, not separate queries: the page already loads every assigned task, so a filtered view derives from that set. Filter selection is local UI state and SHALL NOT live in the store. Because the store always holds the full set, a refresh can reseed it without ever contradicting an active filter.

#### Scenario: Navigate to My Tasks

- **GIVEN** a user logged into the dashboard
- **WHEN** the user clicks "My Tasks" in the sidebar
- **THEN** the user is navigated to `/app/mis-tareas`

#### Scenario: View assigned tasks

- **GIVEN** a user on the My Tasks page
- **WHEN** the page loads
- **THEN** a table is displayed with all tasks assigned to the current user
- **AND** each row shows task name, project name (formatted as "Project (Owner)" for owner context), status, cost, comment count, and a Due Date column with the task's due date and time when set
- **AND** tasks spawned by a routine show a "Routine" badge next to the task name

#### Scenario: Filter tasks by status

- **GIVEN** a user on the My Tasks page
- **WHEN** the user selects a status from the filter dropdown
- **THEN** only tasks with the selected status are shown
- **AND** "Cancelled" is an available filter option
- **AND** no server request is made

#### Scenario: Filter tasks by project

- **GIVEN** a user on the My Tasks page
- **WHEN** the user selects a project from the filter dropdown
- **THEN** only tasks from the selected project are shown
- **AND** no server request is made

#### Scenario: Change task status from My Tasks

- **GIVEN** a user on the My Tasks page viewing a task they are assigned to
- **WHEN** the user selects a different status from the inline status dropdown
- **THEN** the task status changes immediately via optimistic update
- **AND** the global loading indicator shows during the server request
- **AND** a success toast confirms the status change
- **AND** assignees can update their own task status (not just owners and collaborators)

#### Scenario: Overdue task shows indicator in My Tasks

- **GIVEN** a task assigned to the user that is not in the "done" or "cancelled" status and has a due date in the past
- **WHEN** the task is displayed on the My Tasks page
- **THEN** an "Overdue" badge is shown in the Due Date column
- **AND** the due date text is displayed in red

#### Scenario: Cancelled task is read-only on My Tasks

- **GIVEN** a user on the My Tasks page viewing a cancelled task they are assigned to
- **WHEN** the task row is displayed
- **THEN** the status is shown as a read-only badge
- **AND** no status dropdown is available
- **AND** the task does not show the "Overdue" badge even if its due date is in the past

#### Scenario: Open comments from My Tasks

- **GIVEN** a user on the My Tasks page
- **WHEN** the user double-clicks a task row or clicks the comment count button
- **THEN** the comments panel opens as a slide-over Sheet

#### Scenario: Refreshing the tab picks up tasks changed elsewhere

- **GIVEN** a task assigned to the user was completed on another page
- **WHEN** the user returns to the My Tasks tab and the window regains focus
- **THEN** `useRefreshOnFocus` triggers `router.refresh()` and the store reseeds from the fresh result
- **AND** the list shows the task's new status without a full page reload

#### Scenario: A change returned by a routine keeps its comment count

- **GIVEN** a status change on My Tasks returns `nextTask`
- **WHEN** the new task is merged into the store
- **THEN** the existing count of the completed task is preserved rather than reset
- **AND** the new task's visibility in the current filter is derived from the projection

#### Scenario: Forbidden without projects view permission

- **GIVEN** a user without `projects:view` permission
- **WHEN** the user navigates to `/app/mis-tareas`
- **THEN** a 403 forbidden screen is displayed
- **AND** no server error is thrown
