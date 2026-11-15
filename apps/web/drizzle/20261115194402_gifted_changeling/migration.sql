CREATE TABLE "catalog_import_rows" (
	"import_id" uuid,
	"row_number" integer,
	"sku" text,
	"raw" jsonb DEFAULT '{}' NOT NULL,
	"normalized" jsonb DEFAULT '{}' NOT NULL,
	"errors" text[] DEFAULT ARRAY[]::text[] NOT NULL,
	CONSTRAINT "catalog_import_rows_pkey" PRIMARY KEY("import_id","row_number")
);
--> statement-breakpoint
CREATE TABLE "catalog_imports" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"business_id" smallint DEFAULT 1 NOT NULL,
	"file_name" text NOT NULL,
	"status" text DEFAULT 'uploading' NOT NULL,
	"total_rows" integer DEFAULT 0 NOT NULL,
	"update_existing" boolean DEFAULT false NOT NULL,
	"applied_through_row_number" integer DEFAULT 1 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"completed_at" timestamp with time zone,
	CONSTRAINT "catalog_imports_status_check" CHECK ((status = ANY (ARRAY['uploading'::text, 'review'::text, 'imported'::text])))
);
--> statement-breakpoint
CREATE TABLE "products" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
	"business_id" smallint DEFAULT 1 NOT NULL,
	"sku" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"category" text,
	"price" numeric(12,2) NOT NULL,
	"currency" char(3) DEFAULT 'NGN' NOT NULL,
	"stock_quantity" integer DEFAULT 0 NOT NULL,
	"search_terms" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "products_business_id_sku_key" UNIQUE("business_id","sku"),
	CONSTRAINT "products_price_check" CHECK ((price >= 0)),
	CONSTRAINT "products_stock_quantity_check" CHECK ((stock_quantity >= 0))
);
--> statement-breakpoint
CREATE INDEX "catalog_import_rows_import_sku_idx" ON "catalog_import_rows" ("import_id","sku");--> statement-breakpoint
CREATE INDEX "catalog_imports_business_created_idx" ON "catalog_imports" ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "products_business_name_idx" ON "products" ("business_id","name");--> statement-breakpoint
ALTER TABLE "catalog_import_rows" ADD CONSTRAINT "catalog_import_rows_import_id_fkey" FOREIGN KEY ("import_id") REFERENCES "catalog_imports"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "catalog_imports" ADD CONSTRAINT "catalog_imports_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;--> statement-breakpoint
ALTER TABLE "products" ADD CONSTRAINT "products_business_id_fkey" FOREIGN KEY ("business_id") REFERENCES "businesses"("id") ON DELETE CASCADE;