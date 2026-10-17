CREATE TABLE "businesses" (
	"id" text PRIMARY KEY NOT NULL,
	"slug" text NOT NULL,
	"plan_id" text NOT NULL,
	"name" text NOT NULL,
	"tagline" text NOT NULL,
	"description" text NOT NULL,
	"category" text NOT NULL,
	"city" text,
	"palette" jsonb NOT NULL,
	"owner_wallet" text NOT NULL,
	"owner_name" text,
	"owner_phone" text,
	"status" text DEFAULT 'draft' NOT NULL,
	"package" text,
	"domain" text,
	"phone" text,
	"receptionist_name" text,
	"owner_token_version" integer DEFAULT 1 NOT NULL,
	"provisioning" jsonb DEFAULT '{}'::jsonb NOT NULL,
	"sales_count" integer DEFAULT 0 NOT NULL,
	"opened_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "events" (
	"id" text PRIMARY KEY NOT NULL,
	"type" text NOT NULL,
	"slug" text NOT NULL,
	"name" text NOT NULL,
	"amount_atomic" bigint,
	"tx" text,
	"data" jsonb,
	"at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "offers" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"sku" text NOT NULL,
	"title" text NOT NULL,
	"description" text NOT NULL,
	"kind" text NOT NULL,
	"price_atomic" bigint NOT NULL,
	"active" boolean DEFAULT true NOT NULL,
	"position" integer DEFAULT 0 NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "orders" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"offer_id" text NOT NULL,
	"slug" text NOT NULL,
	"sku" text NOT NULL,
	"qty" integer NOT NULL,
	"unit_atomic" bigint NOT NULL,
	"total_atomic" bigint NOT NULL,
	"payer" text NOT NULL,
	"pay_to" text NOT NULL,
	"network" text NOT NULL,
	"payment_key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"tx" text,
	"buyer_note" text,
	"buyer_contact" text,
	"fulfillment" jsonb,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"paid_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "payments" (
	"key" text PRIMARY KEY NOT NULL,
	"purpose" text NOT NULL,
	"ref_id" text NOT NULL,
	"status" text NOT NULL,
	"x402_version" integer NOT NULL,
	"network" text NOT NULL,
	"asset" text NOT NULL,
	"payer" text NOT NULL,
	"pay_to" text NOT NULL,
	"amount_atomic" bigint NOT NULL,
	"tx" text,
	"refund_tx" text,
	"error" text,
	"response" jsonb,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "plans" (
	"id" text PRIMARY KEY NOT NULL,
	"business_id" text NOT NULL,
	"sentence" text NOT NULL,
	"owner_wallet" text NOT NULL,
	"owner_name" text,
	"owner_email" text,
	"owner_phone" text,
	"country" text,
	"status" text DEFAULT 'quoted' NOT NULL,
	"domains" jsonb NOT NULL,
	"recommended_domain" text,
	"prepared" jsonb NOT NULL,
	"open_package" text,
	"open_payment_key" text,
	"open_domain" text,
	"open_steps" jsonb,
	"last_error" text,
	"expires_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_slug_uq" ON "businesses" USING btree ("slug");--> statement-breakpoint
CREATE UNIQUE INDEX "businesses_domain_uq" ON "businesses" USING btree ("domain");--> statement-breakpoint
CREATE INDEX "businesses_status_idx" ON "businesses" USING btree ("status");--> statement-breakpoint
CREATE INDEX "events_at_idx" ON "events" USING btree ("at");--> statement-breakpoint
CREATE UNIQUE INDEX "offers_business_sku_uq" ON "offers" USING btree ("business_id","sku");--> statement-breakpoint
CREATE UNIQUE INDEX "orders_payment_key_uq" ON "orders" USING btree ("payment_key");--> statement-breakpoint
CREATE INDEX "orders_business_idx" ON "orders" USING btree ("business_id","created_at");--> statement-breakpoint
CREATE INDEX "payments_ref_idx" ON "payments" USING btree ("ref_id");--> statement-breakpoint
CREATE INDEX "plans_business_idx" ON "plans" USING btree ("business_id");