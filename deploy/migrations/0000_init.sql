CREATE TABLE "accounts" (
	"id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"github_id" text,
	"recovery_code_hash" text,
	"created_at" timestamp with time zone NOT NULL,
	"last_seen_at" timestamp with time zone NOT NULL,
	"deleted_at" timestamp with time zone,
	CONSTRAINT "accounts_github_id_key" UNIQUE("github_id"),
	CONSTRAINT "accounts_recovery_code_hash_key" UNIQUE("recovery_code_hash")
);
--> statement-breakpoint
CREATE TABLE "chronicles" (
	"game_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"summary" jsonb NOT NULL,
	"score" integer NOT NULL,
	"result" text NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	CONSTRAINT "chronicles_pkey" PRIMARY KEY("game_id","year")
);
--> statement-breakpoint
CREATE TABLE "commands" (
	"game_id" uuid NOT NULL,
	"id" uuid NOT NULL,
	"account_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"type" text NOT NULL,
	"payload" jsonb NOT NULL,
	"request_hash" text NOT NULL,
	"server_time" timestamp with time zone NOT NULL,
	"result" text NOT NULL,
	"error_code" text,
	"response_status" smallint NOT NULL,
	"response_body" jsonb NOT NULL,
	CONSTRAINT "commands_pkey" PRIMARY KEY("game_id","id")
);
--> statement-breakpoint
CREATE TABLE "game_events" (
	"game_id" uuid NOT NULL,
	"seq" bigint NOT NULL,
	"at" timestamp with time zone NOT NULL,
	"kind" text NOT NULL,
	"payload" jsonb NOT NULL,
	CONSTRAINT "game_events_pkey" PRIMARY KEY("game_id","seq")
);
--> statement-breakpoint
CREATE TABLE "games" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"status" text NOT NULL,
	"seed" text NOT NULL,
	"difficulty" text NOT NULL,
	"time_scale" numeric NOT NULL,
	"timezone" text NOT NULL,
	"vigil_hour" smallint NOT NULL,
	"schema_version" integer NOT NULL,
	"state" jsonb NOT NULL,
	"state_version" bigint NOT NULL,
	"last_processed_at" timestamp with time zone NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"updated_at" timestamp with time zone NOT NULL
);
--> statement-breakpoint
CREATE TABLE "refresh_tokens" (
	"token_hash" text PRIMARY KEY NOT NULL,
	"session_id" uuid NOT NULL,
	"created_at" timestamp with time zone NOT NULL,
	"used_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "sessions" (
	"id" uuid PRIMARY KEY NOT NULL,
	"account_id" uuid NOT NULL,
	"device_label" text,
	"created_at" timestamp with time zone NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"revoked_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "chronicles" ADD CONSTRAINT "chronicles_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "commands" ADD CONSTRAINT "commands_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "game_events" ADD CONSTRAINT "game_events_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "games" ADD CONSTRAINT "games_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "refresh_tokens" ADD CONSTRAINT "refresh_tokens_session_id_sessions_id_fk" FOREIGN KEY ("session_id") REFERENCES "public"."sessions"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "accounts_deleted_at_idx" ON "accounts" USING btree ("deleted_at");--> statement-breakpoint
CREATE UNIQUE INDEX "commands_game_seq_key" ON "commands" USING btree ("game_id","seq");--> statement-breakpoint
CREATE INDEX "commands_account_id_idx" ON "commands" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "games_one_active_per_account" ON "games" USING btree ("account_id") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "games_stale_idx" ON "games" USING btree ("last_processed_at") WHERE status = 'active';--> statement-breakpoint
CREATE INDEX "games_account_id_idx" ON "games" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "refresh_tokens_session_id_idx" ON "refresh_tokens" USING btree ("session_id");--> statement-breakpoint
CREATE UNIQUE INDEX "refresh_tokens_one_unused_per_session" ON "refresh_tokens" USING btree ("session_id") WHERE used_at is null;--> statement-breakpoint
CREATE INDEX "sessions_account_id_idx" ON "sessions" USING btree ("account_id");