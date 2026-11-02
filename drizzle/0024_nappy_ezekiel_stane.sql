CREATE TABLE "project_membership" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	"role" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "project_membership_project_id_user_id_pk" PRIMARY KEY("project_id","user_id"),
	CONSTRAINT "project_membership_role_check" CHECK ("project_membership"."role" in ('admin','collaborator'))
);
--> statement-breakpoint
CREATE TABLE "task_assignment" (
	"id" text PRIMARY KEY NOT NULL,
	"task_id" text NOT NULL,
	"user_id" text NOT NULL,
	"status" text DEFAULT 'todo' NOT NULL,
	"comment" text,
	"start_date" timestamp,
	"end_date" timestamp,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "start_date" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "end_date" timestamp;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "recurrence" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "interval" integer DEFAULT 1 NOT NULL;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "days_of_week" text[];--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "start_time" time;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "end_time" time;--> statement-breakpoint
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "project_membership" ADD CONSTRAINT "project_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_task_id_task_id_fk" FOREIGN KEY ("task_id") REFERENCES "public"."task"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "task_assignment" ADD CONSTRAINT "task_assignment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "task_assignment_open_unique" ON "task_assignment" USING btree ("task_id","user_id") WHERE "task_assignment"."status" not in ('done','cancelled');--> statement-breakpoint
CREATE INDEX "task_assignment_user_idx" ON "task_assignment" USING btree ("user_id");--> statement-breakpoint
CREATE VIEW "public"."task_assignment_detail" AS (select "task_assignment"."id" as "assignment_id", "task"."id" as "task_id", "user"."id" as "user_id", "task_assignment"."status" as "status", "task_assignment"."comment" as "comment", "task_assignment"."start_date" as "start_date", "task_assignment"."end_date" as "end_date", "task"."name" as "task_name", "task"."description" as "task_description", "task"."priority" as "task_priority", "task"."recurrence" as "task_recurrence", "task"."project_id" as "project_id", "user"."name" as "user_name", "user"."email" as "user_email", "user"."image" as "user_image" from "task_assignment" inner join "task" on "task_assignment"."task_id" = "task"."id" inner join "user" on "task_assignment"."user_id" = "user"."id");