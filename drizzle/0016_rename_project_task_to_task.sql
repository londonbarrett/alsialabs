ALTER TABLE "project_task" RENAME TO "task";--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "project_task_project_id_project_id_fk";
--> statement-breakpoint
ALTER TABLE "task" DROP CONSTRAINT "project_task_assignee_id_user_id_fk";
--> statement-breakpoint
ALTER TABLE "task_comment" DROP CONSTRAINT "task_comment_task_id_project_task_id_fk";
--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task" ADD CONSTRAINT "task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;