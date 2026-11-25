CREATE TABLE "seasons" (
	"id" uuid PRIMARY KEY NOT NULL,
	"code" text NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"join_ends_at" timestamp with time zone NOT NULL,
	"ends_at" timestamp with time zone NOT NULL,
	"seed" text NOT NULL,
	"difficulty" text NOT NULL,
	"time_scale" numeric NOT NULL,
	"status" text NOT NULL,
	"closed_at" timestamp with time zone,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "seasons_code_key" UNIQUE("code"),
	CONSTRAINT "seasons_starts_at_key" UNIQUE("starts_at")
);
--> statement-breakpoint
ALTER TABLE "games" ADD COLUMN "season_id" uuid;--> statement-breakpoint
CREATE INDEX "seasons_open_ends_at_idx" ON "seasons" USING btree ("ends_at") WHERE status = 'open';--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_season_id_seasons_id_fk" FOREIGN KEY ("season_id") REFERENCES "public"."seasons"("id") ON DELETE restrict ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "games_one_active_personal_per_account" ON "games" USING btree ("account_id") WHERE status = 'active' and season_id is null;--> statement-breakpoint
CREATE UNIQUE INDEX "games_one_per_account_season" ON "games" USING btree ("account_id","season_id") WHERE season_id is not null;--> statement-breakpoint
CREATE INDEX "games_season_id_idx" ON "games" USING btree ("season_id") WHERE season_id is not null;--> statement-breakpoint
DROP INDEX "games_one_active_per_account";