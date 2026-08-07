ALTER TABLE "routine" ADD COLUMN "days_of_week" text[];--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "days_of_month" integer[];--> statement-breakpoint
ALTER TABLE "routine" ADD COLUMN "time" text;--> statement-breakpoint
ALTER TABLE "task" ADD COLUMN "scheduled_for" timestamp;