ALTER TABLE "provider" RENAME TO "store";--> statement-breakpoint
ALTER TABLE "product" RENAME COLUMN "provider_id" TO "store_id";--> statement-breakpoint
ALTER TABLE "product" DROP CONSTRAINT "product_provider_id_provider_id_fk";
--> statement-breakpoint
DROP INDEX "taxonomy_slug_unique";--> statement-breakpoint
DROP INDEX "category_taxonomy_slug_unique";--> statement-breakpoint
ALTER TABLE "client_activity" ADD COLUMN "store_id" text;--> statement-breakpoint
ALTER TABLE "client_reminder" ADD COLUMN "store_id" text;--> statement-breakpoint
ALTER TABLE "client" ADD COLUMN "store_id" text;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "store_id" text;--> statement-breakpoint
ALTER TABLE "store" ADD COLUMN "owner_id" text NOT NULL;--> statement-breakpoint
ALTER TABLE "client_activity" ADD CONSTRAINT "client_activity_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client_reminder" ADD CONSTRAINT "client_reminder_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "client" ADD CONSTRAINT "client_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "product" ADD CONSTRAINT "product_store_id_store_id_fk" FOREIGN KEY ("store_id") REFERENCES "public"."store"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "store" ADD CONSTRAINT "store_owner_id_user_id_fk" FOREIGN KEY ("owner_id") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "taxonomy" ADD CONSTRAINT "taxonomy_slug_unique" UNIQUE("slug");--> statement-breakpoint
ALTER TABLE "category" ADD CONSTRAINT "category_taxonomy_slug_unique" UNIQUE("taxonomy_id","slug");