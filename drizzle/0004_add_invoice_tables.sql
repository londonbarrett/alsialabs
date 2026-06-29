CREATE TABLE "invoice_item" (
	"id" text PRIMARY KEY NOT NULL,
	"invoice_id" text NOT NULL,
	"description" text NOT NULL,
	"quantity" numeric(12, 2) NOT NULL,
	"unit_price" numeric(12, 2) NOT NULL,
	"discount_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"tax_percent" numeric(5, 2) DEFAULT '0' NOT NULL,
	"total" numeric(12, 2) NOT NULL,
	"product_id" text
);
CREATE TABLE "invoice" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"invoice_number" text NOT NULL,
	"client_id" text NOT NULL,
	"status" text DEFAULT 'paid' NOT NULL,
	"issue_date" date NOT NULL,
	"notes" text,
	"subtotal" numeric(12, 2) NOT NULL,
	"discount_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"tax_total" numeric(12, 2) DEFAULT '0' NOT NULL,
	"grand_total" numeric(12, 2) NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "invoice_invoice_number_unique" UNIQUE("invoice_number")
);
--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_invoice_id_invoice_id_fk" FOREIGN KEY ("invoice_id") REFERENCES "public"."invoice"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice_item" ADD CONSTRAINT "invoice_item_product_id_product_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."product"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invoice" ADD CONSTRAINT "invoice_client_id_client_id_fk" FOREIGN KEY ("client_id") REFERENCES "public"."client"("id") ON DELETE no action ON UPDATE no action;