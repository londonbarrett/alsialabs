ALTER TABLE "expense" DROP CONSTRAINT "expense_category_id_expense_category_id_fk";
--> statement-breakpoint
ALTER TABLE "project" DROP CONSTRAINT "project_category_id_project_category_id_fk";
--> statement-breakpoint
DROP TABLE "expense_category" CASCADE;
--> statement-breakpoint
DROP TABLE "project_category" CASCADE;
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "taxonomy" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "category" (
	"id" text PRIMARY KEY NOT NULL,
	"taxonomy_id" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"description" text
);
--> statement-breakpoint
ALTER TABLE "expense" ADD CONSTRAINT "expense_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "project" ADD CONSTRAINT "project_category_id_category_id_fk" FOREIGN KEY ("category_id") REFERENCES "public"."category"("id") ON DELETE no action ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_taxonomy_id_taxonomy_id_fk" FOREIGN KEY ("taxonomy_id") REFERENCES "public"."taxonomy"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "taxonomy_slug_unique" ON "taxonomy" ("slug");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "category_taxonomy_slug_unique" ON "category" ("taxonomy_id","slug");
