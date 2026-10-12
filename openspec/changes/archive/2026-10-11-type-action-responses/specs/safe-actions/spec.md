## ADDED Requirements

### Requirement: Output schema validation

The safe-action clients SHALL validate every action's returned data against its declared output schema before the result leaves the server. A mismatch SHALL be treated as a developer error: it SHALL be logged server-side and SHALL surface through the existing generic server-error handling, SHALL NOT be exposed as a user-facing validation error, and SHALL NOT crash the client.

#### Scenario: A conforming result is returned

- **WHEN** an action returns data that satisfies its output schema
- **THEN** `result.data` is the parsed value and the action succeeds

#### Scenario: A non-conforming result is a logged developer error

- **WHEN** an action returns data that fails its output schema
- **THEN** the mismatch is logged server-side and the call resolves to the generic server error without throwing to the client
