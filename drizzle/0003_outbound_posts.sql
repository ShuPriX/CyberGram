CREATE TABLE "outbound_accounts" (
	"channel" text PRIMARY KEY NOT NULL,
	"token_cipher" text NOT NULL,
	"seed_fingerprint" text NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"refreshed_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "outbound_posts" (
	"id" text PRIMARY KEY NOT NULL,
	"channel" text NOT NULL,
	"key" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"payload" jsonb NOT NULL,
	"caption" text NOT NULL,
	"external_id" text,
	"error" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"published_at" timestamp with time zone
);
--> statement-breakpoint
CREATE UNIQUE INDEX "outbound_posts_key_uq" ON "outbound_posts" USING btree ("channel","key");--> statement-breakpoint
CREATE INDEX "outbound_posts_recent_idx" ON "outbound_posts" USING btree ("channel","created_at");