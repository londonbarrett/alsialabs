ALTER TABLE "project_collaborator" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "project_owner" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
ALTER TABLE "routine" DISABLE ROW LEVEL SECURITY;--> statement-breakpoint
DROP TABLE "project_collaborator" CASCADE;--> statement-breakpoint
DROP TABLE "project_owner" CASCADE;--> statement-breakpoint
DROP TABLE "routine" CASCADE;--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "task_assignee_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "cost";--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "status";--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "routine_id";--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "due_date";--> statement-breakpoint
ALTER TABLE "task" DROP COLUMN "assignee_id";