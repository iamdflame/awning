CREATE TABLE "business_images" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"role" text NOT NULL,
	"prompt" text NOT NULL,
	"model" text NOT NULL,
	"mime" text NOT NULL,
	"width" integer NOT NULL,
	"height" integer NOT NULL,
	"bytes" integer NOT NULL,
	"data_b64" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "business_images_business_role_uq" ON "business_images" USING btree ("business_id","role");--> statement-breakpoint
CREATE INDEX "business_images_created_idx" ON "business_images" USING btree ("created_at");