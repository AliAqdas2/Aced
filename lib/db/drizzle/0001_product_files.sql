CREATE TABLE IF NOT EXISTS "product_files" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"product_id" uuid NOT NULL,
	"asset_id" uuid NOT NULL,
	"sort_order" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_product_id_products_id_fk" FOREIGN KEY ("product_id") REFERENCES "public"."products"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
ALTER TABLE "product_files" ADD CONSTRAINT "product_files_asset_id_assets_id_fk" FOREIGN KEY ("asset_id") REFERENCES "public"."assets"("id") ON DELETE cascade ON UPDATE no action;
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "product_files_product_asset_unique" ON "product_files" USING btree ("product_id","asset_id");
--> statement-breakpoint
INSERT INTO "product_files" ("product_id", "asset_id", "sort_order")
SELECT p."id", p."paid_asset_id", 0
FROM "products" p
WHERE p."paid_asset_id" IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM "product_files" pf
    WHERE pf."product_id" = p."id" AND pf."asset_id" = p."paid_asset_id"
  );
