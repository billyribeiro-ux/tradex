CREATE TABLE `ai_insight` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text,
	`kind` text NOT NULL,
	`summary` text NOT NULL,
	`evidence_trade_ids` text,
	`stat` text,
	`dismissed_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `trading_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `ai_insight_user_idx` ON `ai_insight` (`user_id`);--> statement-breakpoint
CREATE TABLE `attachment` (
	`id` text PRIMARY KEY NOT NULL,
	`kind` text NOT NULL,
	`trade_id` text,
	`journal_entry_id` text,
	`storage_key` text NOT NULL,
	`mime` text,
	`bytes` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`trade_id`) REFERENCES `trade`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`journal_entry_id`) REFERENCES `journal_entry`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `dashboard_layout` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text DEFAULT 'Default' NOT NULL,
	`widgets` text,
	`is_default` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `emotion` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`label` text NOT NULL,
	`valence` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `emotion_user_label_idx` ON `emotion` (`user_id`,`label`);--> statement-breakpoint
CREATE TABLE `execution` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	`option_contract_id` text,
	`side` text NOT NULL,
	`qty` integer NOT NULL,
	`price` integer NOT NULL,
	`fee` integer DEFAULT 0 NOT NULL,
	`commission` integer DEFAULT 0 NOT NULL,
	`executed_at` integer NOT NULL,
	`import_batch_id` text,
	`broker_exec_id` text,
	`dedupe_hash` text NOT NULL,
	`note` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `trading_account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`option_contract_id`) REFERENCES `option_contract`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `execution_dedupe_idx` ON `execution` (`account_id`,`dedupe_hash`);--> statement-breakpoint
CREATE INDEX `execution_account_instrument_time_idx` ON `execution` (`account_id`,`instrument_id`,`executed_at`);--> statement-breakpoint
CREATE TABLE `import_batch` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`source` text NOT NULL,
	`filename` text,
	`mapping_template_id` text,
	`row_count` integer DEFAULT 0 NOT NULL,
	`imported_count` integer DEFAULT 0 NOT NULL,
	`duplicate_count` integer DEFAULT 0 NOT NULL,
	`error_count` integer DEFAULT 0 NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `trading_account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`mapping_template_id`) REFERENCES `import_mapping_template`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `import_batch_account_idx` ON `import_batch` (`account_id`);--> statement-breakpoint
CREATE TABLE `import_mapping_template` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`broker` text NOT NULL,
	`name` text NOT NULL,
	`asset_class` text,
	`column_map` text NOT NULL,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `instrument` (
	`id` text PRIMARY KEY NOT NULL,
	`symbol` text NOT NULL,
	`asset_class` text NOT NULL,
	`exchange` text,
	`name` text,
	`multiplier` integer DEFAULT 100000000 NOT NULL,
	`tick_size` integer,
	`currency` text DEFAULT 'USD' NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `instrument_symbol_class_idx` ON `instrument` (`symbol`,`asset_class`);--> statement-breakpoint
CREATE TABLE `journal_entry` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`account_id` text,
	`date` text NOT NULL,
	`title` text,
	`body` text DEFAULT '' NOT NULL,
	`trade_id` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`account_id`) REFERENCES `trading_account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trade_id`) REFERENCES `trade`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `journal_entry_user_date_idx` ON `journal_entry` (`user_id`,`date`);--> statement-breakpoint
CREATE TABLE `multi_leg_group` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`name` text,
	`strategy` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `trading_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `option_contract` (
	`id` text PRIMARY KEY NOT NULL,
	`underlying_instrument_id` text NOT NULL,
	`type` text NOT NULL,
	`strike` integer NOT NULL,
	`expiry` integer NOT NULL,
	`multiplier` integer DEFAULT 10000000000 NOT NULL,
	FOREIGN KEY (`underlying_instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `option_contract_underlying_idx` ON `option_contract` (`underlying_instrument_id`);--> statement-breakpoint
CREATE TABLE `playbook` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`rules` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `playbook_user_name_idx` ON `playbook` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `prop_firm_config` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`firm` text NOT NULL,
	`profit_target` integer,
	`daily_loss_limit` integer,
	`max_drawdown` integer,
	`drawdown_type` text,
	`min_trading_days` integer,
	`consistency_pct` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `trading_account`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `prop_firm_config_account_idx` ON `prop_firm_config` (`account_id`);--> statement-breakpoint
CREATE TABLE `saved_view` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`screen` text NOT NULL,
	`name` text NOT NULL,
	`filters` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `saved_view_user_screen_idx` ON `saved_view` (`user_id`,`screen`);--> statement-breakpoint
CREATE TABLE `setup` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `setup_user_name_idx` ON `setup` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `share_link` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`trade_id` text,
	`token` text NOT NULL,
	`scope` text,
	`expires_at` integer,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`trade_id`) REFERENCES `trade`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `share_link_token_idx` ON `share_link` (`token`);--> statement-breakpoint
CREATE TABLE `tag` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`color` text,
	`created_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `tag_user_name_idx` ON `tag` (`user_id`,`name`);--> statement-breakpoint
CREATE TABLE `trade` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`instrument_id` text NOT NULL,
	`option_contract_id` text,
	`multi_leg_group_id` text,
	`direction` text NOT NULL,
	`status` text NOT NULL,
	`opened_at` integer NOT NULL,
	`closed_at` integer,
	`qty_opened` integer DEFAULT 0 NOT NULL,
	`qty_closed` integer DEFAULT 0 NOT NULL,
	`avg_entry` integer DEFAULT 0 NOT NULL,
	`avg_exit` integer,
	`gross_pnl` integer DEFAULT 0 NOT NULL,
	`net_pnl` integer DEFAULT 0 NOT NULL,
	`fees` integer DEFAULT 0 NOT NULL,
	`r_multiple` integer,
	`risk_amount` integer,
	`mfe` integer,
	`mae` integer,
	`exit_efficiency` integer,
	`hold_ms` integer,
	`setup_id` text,
	`playbook_id` text,
	`emotion_id` text,
	`confidence` integer,
	`planned_entry` integer,
	`planned_stop` integer,
	`planned_target` integer,
	`planned_qty` integer,
	`rule_compliance_score` integer,
	`notes` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`account_id`) REFERENCES `trading_account`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`instrument_id`) REFERENCES `instrument`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`option_contract_id`) REFERENCES `option_contract`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`multi_leg_group_id`) REFERENCES `multi_leg_group`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`setup_id`) REFERENCES `setup`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`playbook_id`) REFERENCES `playbook`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`emotion_id`) REFERENCES `emotion`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `trade_account_opened_idx` ON `trade` (`account_id`,`opened_at`);--> statement-breakpoint
CREATE INDEX `trade_account_status_idx` ON `trade` (`account_id`,`status`);--> statement-breakpoint
CREATE INDEX `trade_instrument_idx` ON `trade` (`instrument_id`);--> statement-breakpoint
CREATE TABLE `trade_execution` (
	`trade_id` text NOT NULL,
	`execution_id` text NOT NULL,
	PRIMARY KEY(`trade_id`, `execution_id`),
	FOREIGN KEY (`trade_id`) REFERENCES `trade`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`execution_id`) REFERENCES `execution`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trade_execution_execution_idx` ON `trade_execution` (`execution_id`);--> statement-breakpoint
CREATE TABLE `trade_tag` (
	`trade_id` text NOT NULL,
	`tag_id` text NOT NULL,
	PRIMARY KEY(`trade_id`, `tag_id`),
	FOREIGN KEY (`trade_id`) REFERENCES `trade`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`tag_id`) REFERENCES `tag`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `trading_account` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`broker` text,
	`asset_classes` text DEFAULT '["stock"]' NOT NULL,
	`base_currency` text DEFAULT 'USD' NOT NULL,
	`starting_balance` integer DEFAULT 0 NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`is_prop_firm` integer DEFAULT false NOT NULL,
	`created_at` integer NOT NULL,
	`archived_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `trading_account_user_idx` ON `trading_account` (`user_id`);--> statement-breakpoint
CREATE TABLE `user_settings` (
	`user_id` text PRIMARY KEY NOT NULL,
	`base_currency` text DEFAULT 'USD' NOT NULL,
	`timezone` text DEFAULT 'UTC' NOT NULL,
	`theme` text DEFAULT 'dark' NOT NULL,
	`default_account_id` text,
	`ai_provider` text DEFAULT 'anthropic',
	`ai_model` text,
	`ai_api_key_enc` text,
	`created_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`account_id` text NOT NULL,
	`provider_id` text NOT NULL,
	`user_id` text NOT NULL,
	`access_token` text,
	`refresh_token` text,
	`id_token` text,
	`access_token_expires_at` integer,
	`refresh_token_expires_at` integer,
	`scope` text,
	`password` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`user_id`);--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expires_at` integer NOT NULL,
	`token` text NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer NOT NULL,
	`ip_address` text,
	`user_agent` text,
	`user_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`user_id`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`email_verified` integer DEFAULT false NOT NULL,
	`image` text,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL,
	`updated_at` integer DEFAULT (cast(unixepoch('subsecond') * 1000 as integer)) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);