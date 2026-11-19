CREATE TABLE "legacy_ledger" (
	"account_id" uuid NOT NULL,
	"game_id" uuid NOT NULL,
	"year" integer NOT NULL,
	"points" integer NOT NULL
);
--> statement-breakpoint
ALTER TABLE "legacy_ledger" ADD CONSTRAINT "legacy_ledger_account_id_accounts_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."accounts"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_ledger" ADD CONSTRAINT "legacy_ledger_game_id_games_id_fk" FOREIGN KEY ("game_id") REFERENCES "public"."games"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "legacy_ledger_game_year_key" ON "legacy_ledger" USING btree ("game_id","year");--> statement-breakpoint
CREATE INDEX "legacy_ledger_account_id_idx" ON "legacy_ledger" USING btree ("account_id");