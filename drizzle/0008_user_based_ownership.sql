-- Migration: User-based ownership (idempotent — safe to re-run)

-- 1. Create new tables (IF NOT EXISTS)
CREATE TABLE IF NOT EXISTS "contractor_profile" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"bio" text,
	"hourly_rate" numeric(10, 2),
	"portfolio_links" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "contractor_profile_user_id_unique" UNIQUE("user_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_collaborator" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "project_collaborator_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint

CREATE TABLE IF NOT EXISTS "project_owner" (
	"project_id" text NOT NULL,
	"user_id" text NOT NULL,
	CONSTRAINT "project_owner_project_id_user_id_pk" PRIMARY KEY("project_id","user_id")
);
--> statement-breakpoint

-- 2. Add foreign key constraints for new tables (safe to re-run via DO block)
DO $$ BEGIN
  ALTER TABLE "contractor_profile" ADD CONSTRAINT "contractor_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "project_collaborator" ADD CONSTRAINT "project_collaborator_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "project_collaborator" ADD CONSTRAINT "project_collaborator_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "project_owner" ADD CONSTRAINT "project_owner_project_id_project_id_fk" FOREIGN KEY ("project_id") REFERENCES "public"."project"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "project_owner" ADD CONSTRAINT "project_owner_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- 3. Add new columns to existing tables (IF NOT EXISTS)
ALTER TABLE "project" ADD COLUMN IF NOT EXISTS "primary_owner_id" text;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "project" ADD CONSTRAINT "project_primary_owner_id_user_id_fk" FOREIGN KEY ("primary_owner_id") REFERENCES "public"."user"("id") ON DELETE restrict ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "invoice" ADD COLUMN IF NOT EXISTS "user_id" text;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "invoice" ADD CONSTRAINT "invoice_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

ALTER TABLE "project_task" ADD COLUMN IF NOT EXISTS "cost" numeric(10, 2);
--> statement-breakpoint

ALTER TABLE "project_task" ADD COLUMN IF NOT EXISTS "assignee_id" text;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "project_task" ADD CONSTRAINT "project_task_assignee_id_user_id_fk" FOREIGN KEY ("assignee_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
--> statement-breakpoint

-- 4. Rename tables (only if old name exists)
DO $$ BEGIN
  ALTER TABLE "activity" RENAME TO "client_activity";
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "reminder" RENAME TO "client_reminder";
EXCEPTION WHEN undefined_table THEN NULL;
END $$;
--> statement-breakpoint

-- 5. Update task_comment table
ALTER TABLE "task_comment" DROP COLUMN IF EXISTS "author_type";
--> statement-breakpoint

DO $$ BEGIN
  ALTER TABLE "task_comment" ADD CONSTRAINT "task_comment_author_id_user_id_fk" FOREIGN KEY ("author_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
