CREATE TABLE "ai_insight" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"kind" text NOT NULL,
	"summary" text NOT NULL,
	"evidence_trade_ids" jsonb,
	"stat" jsonb,
	"dismissed_at" bigint,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "attachment" (
	"id" text PRIMARY KEY NOT NULL,
	"kind" text NOT NULL,
	"trade_id" text,
	"journal_entry_id" text,
	"storage_key" text NOT NULL,
	"mime" text,
	"bytes" integer,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "dashboard_layout" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text DEFAULT 'Default' NOT NULL,
	"widgets" jsonb,
	"is_default" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "emotion" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"label" text NOT NULL,
	"valence" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "execution" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"instrument_id" text NOT NULL,
	"option_contract_id" text,
	"side" text NOT NULL,
	"qty" bigint NOT NULL,
	"price" bigint NOT NULL,
	"fee" bigint DEFAULT 0 NOT NULL,
	"commission" bigint DEFAULT 0 NOT NULL,
	"executed_at" bigint NOT NULL,
	"import_batch_id" text,
	"broker_exec_id" text,
	"dedupe_hash" text NOT NULL,
	"note" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_batch" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"source" text NOT NULL,
	"filename" text,
	"mapping_template_id" text,
	"row_count" integer DEFAULT 0 NOT NULL,
	"imported_count" integer DEFAULT 0 NOT NULL,
	"duplicate_count" integer DEFAULT 0 NOT NULL,
	"error_count" integer DEFAULT 0 NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "import_mapping_template" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"broker" text NOT NULL,
	"name" text NOT NULL,
	"asset_class" text,
	"column_map" jsonb NOT NULL,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "instrument" (
	"id" text PRIMARY KEY NOT NULL,
	"symbol" text NOT NULL,
	"asset_class" text NOT NULL,
	"exchange" text,
	"name" text,
	"multiplier" bigint DEFAULT 100000000 NOT NULL,
	"tick_size" bigint,
	"currency" text DEFAULT 'USD' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "journal_entry" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"account_id" text,
	"date" text NOT NULL,
	"title" text,
	"body" text DEFAULT '' NOT NULL,
	"trade_id" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "multi_leg_group" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"name" text,
	"strategy" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "option_contract" (
	"id" text PRIMARY KEY NOT NULL,
	"underlying_instrument_id" text NOT NULL,
	"type" text NOT NULL,
	"strike" bigint NOT NULL,
	"expiry" bigint NOT NULL,
	"multiplier" bigint DEFAULT 10000000000 NOT NULL
);
--> statement-breakpoint
CREATE TABLE "playbook" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"rules" jsonb,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "prop_firm_config" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"firm" text NOT NULL,
	"profit_target" bigint,
	"daily_loss_limit" bigint,
	"max_drawdown" bigint,
	"drawdown_type" text,
	"min_trading_days" integer,
	"consistency_pct" integer,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "saved_view" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"screen" text NOT NULL,
	"name" text NOT NULL,
	"filters" jsonb,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "setup" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"description" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "share_link" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"trade_id" text,
	"token" text NOT NULL,
	"scope" jsonb,
	"expires_at" bigint,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "tag" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"color" text,
	"created_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"instrument_id" text NOT NULL,
	"option_contract_id" text,
	"multi_leg_group_id" text,
	"direction" text NOT NULL,
	"status" text NOT NULL,
	"opened_at" bigint NOT NULL,
	"closed_at" bigint,
	"qty_opened" bigint DEFAULT 0 NOT NULL,
	"qty_closed" bigint DEFAULT 0 NOT NULL,
	"avg_entry" bigint DEFAULT 0 NOT NULL,
	"avg_exit" bigint,
	"gross_pnl" bigint DEFAULT 0 NOT NULL,
	"net_pnl" bigint DEFAULT 0 NOT NULL,
	"fees" bigint DEFAULT 0 NOT NULL,
	"r_multiple" bigint,
	"risk_amount" bigint,
	"mfe" bigint,
	"mae" bigint,
	"exit_efficiency" bigint,
	"hold_ms" bigint,
	"setup_id" text,
	"playbook_id" text,
	"emotion_id" text,
	"confidence" integer,
	"planned_entry" bigint,
	"planned_stop" bigint,
	"planned_target" bigint,
	"planned_qty" bigint,
	"rule_compliance_score" integer,
	"notes" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "trade_execution" (
	"trade_id" text NOT NULL,
	"execution_id" text NOT NULL,
	CONSTRAINT "trade_execution_trade_id_execution_id_pk" PRIMARY KEY("trade_id","execution_id")
);
--> statement-breakpoint
CREATE TABLE "trade_tag" (
	"trade_id" text NOT NULL,
	"tag_id" text NOT NULL,
	CONSTRAINT "trade_tag_trade_id_tag_id_pk" PRIMARY KEY("trade_id","tag_id")
);
--> statement-breakpoint
CREATE TABLE "trading_account" (
	"id" text PRIMARY KEY NOT NULL,
	"user_id" text NOT NULL,
	"name" text NOT NULL,
	"broker" text,
	"asset_classes" jsonb DEFAULT '["stock"]'::jsonb NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"starting_balance" bigint DEFAULT 0 NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"is_prop_firm" boolean DEFAULT false NOT NULL,
	"created_at" bigint NOT NULL,
	"archived_at" bigint
);
--> statement-breakpoint
CREATE TABLE "user_settings" (
	"user_id" text PRIMARY KEY NOT NULL,
	"base_currency" text DEFAULT 'USD' NOT NULL,
	"timezone" text DEFAULT 'UTC' NOT NULL,
	"theme" text DEFAULT 'dark' NOT NULL,
	"default_account_id" text,
	"ai_provider" text DEFAULT 'anthropic',
	"ai_model" text,
	"ai_api_key_enc" text,
	"created_at" bigint NOT NULL,
	"updated_at" bigint NOT NULL
);
--> statement-breakpoint
CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"account_id" text NOT NULL,
	"provider_id" text NOT NULL,
	"user_id" text NOT NULL,
	"access_token" text,
	"refresh_token" text,
	"id_token" text,
	"access_token_expires_at" timestamp,
	"refresh_token_expires_at" timestamp,
	"scope" text,
	"password" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expires_at" timestamp NOT NULL,
	"token" text NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp NOT NULL,
	"ip_address" text,
	"user_agent" text,
	"user_id" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"email_verified" boolean DEFAULT false NOT NULL,
	"image" text,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expires_at" timestamp NOT NULL,
	"created_at" timestamp DEFAULT now() NOT NULL,
	"updated_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "ai_insight" ADD CONSTRAINT "ai_insight_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "ai_insight" ADD CONSTRAINT "ai_insight_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attachment" ADD CONSTRAINT "attachment_journal_entry_id_journal_entry_id_fk" FOREIGN KEY ("journal_entry_id") REFERENCES "public"."journal_entry"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "dashboard_layout" ADD CONSTRAINT "dashboard_layout_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "emotion" ADD CONSTRAINT "emotion_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_instrument_id_instrument_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrument"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "execution" ADD CONSTRAINT "execution_option_contract_id_option_contract_id_fk" FOREIGN KEY ("option_contract_id") REFERENCES "public"."option_contract"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_batch" ADD CONSTRAINT "import_batch_mapping_template_id_import_mapping_template_id_fk" FOREIGN KEY ("mapping_template_id") REFERENCES "public"."import_mapping_template"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "import_mapping_template" ADD CONSTRAINT "import_mapping_template_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "journal_entry" ADD CONSTRAINT "journal_entry_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "multi_leg_group" ADD CONSTRAINT "multi_leg_group_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "option_contract" ADD CONSTRAINT "option_contract_underlying_instrument_id_instrument_id_fk" FOREIGN KEY ("underlying_instrument_id") REFERENCES "public"."instrument"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "playbook" ADD CONSTRAINT "playbook_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prop_firm_config" ADD CONSTRAINT "prop_firm_config_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "saved_view" ADD CONSTRAINT "saved_view_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "setup" ADD CONSTRAINT "setup_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "share_link" ADD CONSTRAINT "share_link_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tag" ADD CONSTRAINT "tag_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_account_id_trading_account_id_fk" FOREIGN KEY ("account_id") REFERENCES "public"."trading_account"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_instrument_id_instrument_id_fk" FOREIGN KEY ("instrument_id") REFERENCES "public"."instrument"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_option_contract_id_option_contract_id_fk" FOREIGN KEY ("option_contract_id") REFERENCES "public"."option_contract"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_multi_leg_group_id_multi_leg_group_id_fk" FOREIGN KEY ("multi_leg_group_id") REFERENCES "public"."multi_leg_group"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_setup_id_setup_id_fk" FOREIGN KEY ("setup_id") REFERENCES "public"."setup"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_playbook_id_playbook_id_fk" FOREIGN KEY ("playbook_id") REFERENCES "public"."playbook"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade" ADD CONSTRAINT "trade_emotion_id_emotion_id_fk" FOREIGN KEY ("emotion_id") REFERENCES "public"."emotion"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_execution" ADD CONSTRAINT "trade_execution_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_execution" ADD CONSTRAINT "trade_execution_execution_id_execution_id_fk" FOREIGN KEY ("execution_id") REFERENCES "public"."execution"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_tag" ADD CONSTRAINT "trade_tag_trade_id_trade_id_fk" FOREIGN KEY ("trade_id") REFERENCES "public"."trade"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trade_tag" ADD CONSTRAINT "trade_tag_tag_id_tag_id_fk" FOREIGN KEY ("tag_id") REFERENCES "public"."tag"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "trading_account" ADD CONSTRAINT "trading_account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "user_settings" ADD CONSTRAINT "user_settings_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "ai_insight_user_idx" ON "ai_insight" USING btree ("user_id");--> statement-breakpoint
CREATE UNIQUE INDEX "emotion_user_label_idx" ON "emotion" USING btree ("user_id","label");--> statement-breakpoint
CREATE UNIQUE INDEX "execution_dedupe_idx" ON "execution" USING btree ("account_id","dedupe_hash");--> statement-breakpoint
CREATE INDEX "execution_account_instrument_time_idx" ON "execution" USING btree ("account_id","instrument_id","executed_at");--> statement-breakpoint
CREATE INDEX "import_batch_account_idx" ON "import_batch" USING btree ("account_id");--> statement-breakpoint
CREATE UNIQUE INDEX "instrument_symbol_class_idx" ON "instrument" USING btree ("symbol","asset_class");--> statement-breakpoint
CREATE INDEX "journal_entry_user_date_idx" ON "journal_entry" USING btree ("user_id","date");--> statement-breakpoint
CREATE INDEX "option_contract_underlying_idx" ON "option_contract" USING btree ("underlying_instrument_id");--> statement-breakpoint
CREATE UNIQUE INDEX "playbook_user_name_idx" ON "playbook" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "prop_firm_config_account_idx" ON "prop_firm_config" USING btree ("account_id");--> statement-breakpoint
CREATE INDEX "saved_view_user_screen_idx" ON "saved_view" USING btree ("user_id","screen");--> statement-breakpoint
CREATE UNIQUE INDEX "setup_user_name_idx" ON "setup" USING btree ("user_id","name");--> statement-breakpoint
CREATE UNIQUE INDEX "share_link_token_idx" ON "share_link" USING btree ("token");--> statement-breakpoint
CREATE UNIQUE INDEX "tag_user_name_idx" ON "tag" USING btree ("user_id","name");--> statement-breakpoint
CREATE INDEX "trade_account_opened_idx" ON "trade" USING btree ("account_id","opened_at");--> statement-breakpoint
CREATE INDEX "trade_account_status_idx" ON "trade" USING btree ("account_id","status");--> statement-breakpoint
CREATE INDEX "trade_instrument_idx" ON "trade" USING btree ("instrument_id");--> statement-breakpoint
CREATE INDEX "trade_execution_execution_idx" ON "trade_execution" USING btree ("execution_id");--> statement-breakpoint
CREATE INDEX "trading_account_user_idx" ON "trading_account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");