-- One-off backfill for legacy one-off tasks. Before Task 4 these tasks stored
-- a UTC wall-clock string in a timestamp-without-time-zone column; Task 4
-- converted those values to true instants with AT TIME ZONE 'UTC'. The wall
-- clock the project's user entered is therefore the instant interpreted in
-- projects.time_zone. A task whose stored day has a non-midnight wall-clock
-- time is a timed task: mirror that time into the `time` columns so the form
-- and every DTO agree that all-day means start_time === null.
--
-- Midnight rows are genuine all-day work and keep their time columns NULL.
-- Rows whose time columns are already set (including repeating tasks written
-- by the current code) are excluded by the WHERE and left untouched.
UPDATE "task" AS t
SET
  "start_time" = CASE
    WHEN t."start_time" IS NULL
      AND t."start_date" IS NOT NULL
      AND (t."start_date" AT TIME ZONE p."time_zone")::time <> time '00:00'
    THEN to_char(t."start_date" AT TIME ZONE p."time_zone", 'HH24:MI')::time
    ELSE t."start_time"
  END,
  "end_time" = CASE
    WHEN t."end_time" IS NULL
      AND t."end_date" IS NOT NULL
      AND (t."end_date" AT TIME ZONE p."time_zone")::time <> time '00:00'
    THEN to_char(t."end_date" AT TIME ZONE p."time_zone", 'HH24:MI')::time
    ELSE t."end_time"
  END
FROM "project" AS p
WHERE t."project_id" = p."id"
  AND (t."start_time" IS NULL OR t."end_time" IS NULL)
  AND (
    (t."start_time" IS NULL
      AND t."start_date" IS NOT NULL
      AND (t."start_date" AT TIME ZONE p."time_zone")::time <> time '00:00')
    OR
    (t."end_time" IS NULL
      AND t."end_date" IS NOT NULL
      AND (t."end_date" AT TIME ZONE p."time_zone")::time <> time '00:00')
  );
