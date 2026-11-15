CREATE TABLE "news_items" (
	"id" text PRIMARY KEY NOT NULL,
	"source" text NOT NULL,
	"source_name" text NOT NULL,
	"source_kind" text NOT NULL,
	"title" text NOT NULL,
	"url" text NOT NULL,
	"excerpt" text,
	"published_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "profiles" ALTER COLUMN "message_policy" SET DEFAULT 'connections';--> statement-breakpoint
CREATE UNIQUE INDEX "news_items_url_uq" ON "news_items" USING btree ("url");--> statement-breakpoint
CREATE INDEX "news_items_published_idx" ON "news_items" USING btree ("published_at");--> statement-breakpoint
CREATE INDEX "news_items_source_idx" ON "news_items" USING btree ("source","published_at");--> statement-breakpoint
UPDATE "profiles" SET "message_policy" = 'connections' WHERE "message_policy" = 'everyone';
