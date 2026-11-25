ALTER TABLE "project" ALTER COLUMN "time_zone" SET NOT NULL;--> statement-breakpoint
CREATE VIEW "public"."task_assignment_latest" AS (select "assignment_id", "task_id", "user_id", "status", "comment", "cost", "start_date", "end_date", "start_time", "user_name", "user_email", "user_image" from (select "assignment_id", "task_id", "user_id", "status", "comment", "cost", "start_date", "end_date", "start_time", "user_name", "user_email", "user_image", row_number() over (
          partition by "task_id", "user_id"
          order by (case when "status" in ('done','cancelled') then 1 else 0 end) asc,
                   "start_date" desc nulls last
        ) as "rn" from "task_assignment_detail") "numbered" where "rn" = 1);