CREATE TABLE "invoice_payment" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"amount" numeric(12, 2) NOT NULL,
	"payment_date" date NOT NULL,
	"method" text,
	"reference" text,
	"notes" text,
	"user_id" text,
	"created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "invoice" ALTER COLUMN "status" SET DEFAULT 'draft';--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "due_date" date;--> statement-breakpoint
ALTER TABLE "invoice" ADD COLUMN "paid_amount" numeric(12, 2) DEFAULT '0' NOT NULL;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_payment" ADD CONSTRAINT "invoice_payment_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;