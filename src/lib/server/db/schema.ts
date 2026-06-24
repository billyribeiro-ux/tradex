import {
	sqliteTable,
	text,
	integer,
	index,
	uniqueIndex,
	primaryKey
} from 'drizzle-orm/sqlite-core';
import { user } from './auth.schema';
import { SCALE } from '$lib/money';
import type {
	AssetClass,
	Side,
	Direction,
	TradeStatus,
	OptionType,
	ImportSource,
	PropFirm,
	DrawdownType,
	AttachmentKind
} from '$lib/domain/enums';

/**
 * Conventions
 * - ids: text UUIDs
 * - money / price / quantity / multiplier: integer scaled by 1e8 (see $lib/money)
 * - timestamps: integer UTC epoch milliseconds
 */
const pk = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
const createdAt = () =>
	integer('created_at')
		.notNull()
		.$defaultFn(() => Date.now());
const updatedAt = () =>
	integer('updated_at')
		.notNull()
		.$defaultFn(() => Date.now())
		.$onUpdate(() => Date.now());

// ---------------------------------------------------------------------------
// User settings (1:1 with Better Auth user)
// ---------------------------------------------------------------------------
export const userSettings = sqliteTable('user_settings', {
	userId: text('user_id')
		.primaryKey()
		.references(() => user.id, { onDelete: 'cascade' }),
	baseCurrency: text('base_currency').notNull().default('USD'),
	timezone: text('timezone').notNull().default('UTC'),
	theme: text('theme').notNull().default('dark'),
	defaultAccountId: text('default_account_id'),
	aiProvider: text('ai_provider').default('anthropic'),
	aiModel: text('ai_model'),
	aiApiKeyEnc: text('ai_api_key_enc'),
	createdAt: createdAt(),
	updatedAt: updatedAt()
});

// ---------------------------------------------------------------------------
// Accounts
// ---------------------------------------------------------------------------
export const tradingAccount = sqliteTable(
	'trading_account',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		broker: text('broker'),
		assetClasses: text('asset_classes', { mode: 'json' })
			.$type<AssetClass[]>()
			.notNull()
			.default(['stock']),
		baseCurrency: text('base_currency').notNull().default('USD'),
		startingBalance: integer('starting_balance').notNull().default(0),
		timezone: text('timezone').notNull().default('UTC'),
		isPropFirm: integer('is_prop_firm', { mode: 'boolean' }).notNull().default(false),
		createdAt: createdAt(),
		archivedAt: integer('archived_at')
	},
	(t) => [index('trading_account_user_idx').on(t.userId)]
);

// ---------------------------------------------------------------------------
// Instruments (global reference data)
// ---------------------------------------------------------------------------
export const instrument = sqliteTable(
	'instrument',
	{
		id: pk(),
		symbol: text('symbol').notNull(),
		assetClass: text('asset_class').$type<AssetClass>().notNull(),
		exchange: text('exchange'),
		name: text('name'),
		// contract size / point value, scaled (1.0 default)
		multiplier: integer('multiplier').notNull().default(SCALE),
		tickSize: integer('tick_size'),
		currency: text('currency').notNull().default('USD')
	},
	(t) => [uniqueIndex('instrument_symbol_class_idx').on(t.symbol, t.assetClass)]
);

export const optionContract = sqliteTable(
	'option_contract',
	{
		id: pk(),
		underlyingInstrumentId: text('underlying_instrument_id')
			.notNull()
			.references(() => instrument.id, { onDelete: 'cascade' }),
		type: text('type').$type<OptionType>().notNull(),
		strike: integer('strike').notNull(),
		expiry: integer('expiry').notNull(),
		multiplier: integer('multiplier')
			.notNull()
			.default(100 * SCALE)
	},
	(t) => [index('option_contract_underlying_idx').on(t.underlyingInstrumentId)]
);

// ---------------------------------------------------------------------------
// Multi-leg groups (option structures: vertical, condor, ...)
// ---------------------------------------------------------------------------
export const multiLegGroup = sqliteTable('multi_leg_group', {
	id: pk(),
	accountId: text('account_id')
		.notNull()
		.references(() => tradingAccount.id, { onDelete: 'cascade' }),
	name: text('name'),
	strategy: text('strategy'),
	createdAt: createdAt()
});

// ---------------------------------------------------------------------------
// Executions (raw fills — the source of truth)
// ---------------------------------------------------------------------------
export const execution = sqliteTable(
	'execution',
	{
		id: pk(),
		accountId: text('account_id')
			.notNull()
			.references(() => tradingAccount.id, { onDelete: 'cascade' }),
		instrumentId: text('instrument_id')
			.notNull()
			.references(() => instrument.id),
		optionContractId: text('option_contract_id').references(() => optionContract.id),
		side: text('side').$type<Side>().notNull(),
		qty: integer('qty').notNull(),
		price: integer('price').notNull(),
		fee: integer('fee').notNull().default(0),
		commission: integer('commission').notNull().default(0),
		executedAt: integer('executed_at').notNull(),
		importBatchId: text('import_batch_id'),
		brokerExecId: text('broker_exec_id'),
		dedupeHash: text('dedupe_hash').notNull(),
		note: text('note'),
		createdAt: createdAt()
	},
	(t) => [
		uniqueIndex('execution_dedupe_idx').on(t.accountId, t.dedupeHash),
		index('execution_account_instrument_time_idx').on(t.accountId, t.instrumentId, t.executedAt)
	]
);

// ---------------------------------------------------------------------------
// Categorization: tags, setups, emotions, playbooks
// ---------------------------------------------------------------------------
export const tag = sqliteTable(
	'tag',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		color: text('color'),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('tag_user_name_idx').on(t.userId, t.name)]
);

export const setup = sqliteTable(
	'setup',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('setup_user_name_idx').on(t.userId, t.name)]
);

export const emotion = sqliteTable(
	'emotion',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		label: text('label').notNull(),
		valence: integer('valence').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('emotion_user_label_idx').on(t.userId, t.label)]
);

export type PlaybookRules = {
	entryCriteria?: string[];
	exitRules?: string[];
	maxRiskPct?: number;
	minRR?: number;
	riskRules?: string[];
};

export const playbook = sqliteTable(
	'playbook',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		rules: text('rules', { mode: 'json' }).$type<PlaybookRules>(),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('playbook_user_name_idx').on(t.userId, t.name)]
);

// ---------------------------------------------------------------------------
// Trades (derived from executions)
// ---------------------------------------------------------------------------
export const trade = sqliteTable(
	'trade',
	{
		id: pk(),
		accountId: text('account_id')
			.notNull()
			.references(() => tradingAccount.id, { onDelete: 'cascade' }),
		instrumentId: text('instrument_id')
			.notNull()
			.references(() => instrument.id),
		optionContractId: text('option_contract_id').references(() => optionContract.id),
		multiLegGroupId: text('multi_leg_group_id').references(() => multiLegGroup.id),
		direction: text('direction').$type<Direction>().notNull(),
		status: text('status').$type<TradeStatus>().notNull(),
		openedAt: integer('opened_at').notNull(),
		closedAt: integer('closed_at'),
		qtyOpened: integer('qty_opened').notNull().default(0),
		qtyClosed: integer('qty_closed').notNull().default(0),
		avgEntry: integer('avg_entry').notNull().default(0),
		avgExit: integer('avg_exit'),
		grossPnl: integer('gross_pnl').notNull().default(0),
		netPnl: integer('net_pnl').notNull().default(0),
		fees: integer('fees').notNull().default(0),
		rMultiple: integer('r_multiple'),
		riskAmount: integer('risk_amount'),
		mfe: integer('mfe'),
		mae: integer('mae'),
		exitEfficiency: integer('exit_efficiency'),
		holdMs: integer('hold_ms'),
		setupId: text('setup_id').references(() => setup.id, { onDelete: 'set null' }),
		playbookId: text('playbook_id').references(() => playbook.id, { onDelete: 'set null' }),
		emotionId: text('emotion_id').references(() => emotion.id, { onDelete: 'set null' }),
		confidence: integer('confidence'),
		plannedEntry: integer('planned_entry'),
		plannedStop: integer('planned_stop'),
		plannedTarget: integer('planned_target'),
		plannedQty: integer('planned_qty'),
		ruleComplianceScore: integer('rule_compliance_score'),
		notes: text('notes'),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [
		index('trade_account_opened_idx').on(t.accountId, t.openedAt),
		index('trade_account_status_idx').on(t.accountId, t.status),
		index('trade_instrument_idx').on(t.instrumentId)
	]
);

export const tradeExecution = sqliteTable(
	'trade_execution',
	{
		tradeId: text('trade_id')
			.notNull()
			.references(() => trade.id, { onDelete: 'cascade' }),
		executionId: text('execution_id')
			.notNull()
			.references(() => execution.id, { onDelete: 'cascade' })
	},
	(t) => [
		primaryKey({ columns: [t.tradeId, t.executionId] }),
		index('trade_execution_execution_idx').on(t.executionId)
	]
);

export const tradeTag = sqliteTable(
	'trade_tag',
	{
		tradeId: text('trade_id')
			.notNull()
			.references(() => trade.id, { onDelete: 'cascade' }),
		tagId: text('tag_id')
			.notNull()
			.references(() => tag.id, { onDelete: 'cascade' })
	},
	(t) => [primaryKey({ columns: [t.tradeId, t.tagId] })]
);

// ---------------------------------------------------------------------------
// Risk / prop-firm
// ---------------------------------------------------------------------------
export const propFirmConfig = sqliteTable(
	'prop_firm_config',
	{
		id: pk(),
		accountId: text('account_id')
			.notNull()
			.references(() => tradingAccount.id, { onDelete: 'cascade' }),
		firm: text('firm').$type<PropFirm>().notNull(),
		profitTarget: integer('profit_target'),
		dailyLossLimit: integer('daily_loss_limit'),
		maxDrawdown: integer('max_drawdown'),
		drawdownType: text('drawdown_type').$type<DrawdownType>(),
		minTradingDays: integer('min_trading_days'),
		consistencyPct: integer('consistency_pct'),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('prop_firm_config_account_idx').on(t.accountId)]
);

// ---------------------------------------------------------------------------
// Journal & attachments
// ---------------------------------------------------------------------------
export const journalEntry = sqliteTable(
	'journal_entry',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accountId: text('account_id').references(() => tradingAccount.id, { onDelete: 'cascade' }),
		date: text('date').notNull(), // YYYY-MM-DD (account-local)
		title: text('title'),
		body: text('body').notNull().default(''),
		tradeId: text('trade_id').references(() => trade.id, { onDelete: 'set null' }),
		createdAt: createdAt(),
		updatedAt: updatedAt()
	},
	(t) => [index('journal_entry_user_date_idx').on(t.userId, t.date)]
);

export const attachment = sqliteTable('attachment', {
	id: pk(),
	kind: text('kind').$type<AttachmentKind>().notNull(),
	tradeId: text('trade_id').references(() => trade.id, { onDelete: 'cascade' }),
	journalEntryId: text('journal_entry_id').references(() => journalEntry.id, {
		onDelete: 'cascade'
	}),
	storageKey: text('storage_key').notNull(),
	mime: text('mime'),
	bytes: integer('bytes'),
	createdAt: createdAt()
});

// ---------------------------------------------------------------------------
// Import
// ---------------------------------------------------------------------------
export const importMappingTemplate = sqliteTable('import_mapping_template', {
	id: pk(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	broker: text('broker').notNull(),
	name: text('name').notNull(),
	assetClass: text('asset_class').$type<AssetClass>(),
	columnMap: text('column_map', { mode: 'json' }).$type<Record<string, string>>().notNull(),
	createdAt: createdAt()
});

export const importBatch = sqliteTable(
	'import_batch',
	{
		id: pk(),
		accountId: text('account_id')
			.notNull()
			.references(() => tradingAccount.id, { onDelete: 'cascade' }),
		source: text('source').$type<ImportSource>().notNull(),
		filename: text('filename'),
		mappingTemplateId: text('mapping_template_id').references(() => importMappingTemplate.id, {
			onDelete: 'set null'
		}),
		rowCount: integer('row_count').notNull().default(0),
		importedCount: integer('imported_count').notNull().default(0),
		duplicateCount: integer('duplicate_count').notNull().default(0),
		errorCount: integer('error_count').notNull().default(0),
		createdAt: createdAt()
	},
	(t) => [index('import_batch_account_idx').on(t.accountId)]
);

// ---------------------------------------------------------------------------
// Sharing, AI insights, dashboard layouts, saved views
// ---------------------------------------------------------------------------
export const shareLink = sqliteTable(
	'share_link',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		tradeId: text('trade_id').references(() => trade.id, { onDelete: 'cascade' }),
		token: text('token').notNull(),
		scope: text('scope', { mode: 'json' }).$type<{ hideSize?: boolean; hidePnl?: boolean }>(),
		expiresAt: integer('expires_at'),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('share_link_token_idx').on(t.token)]
);

export const aiInsight = sqliteTable(
	'ai_insight',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accountId: text('account_id').references(() => tradingAccount.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		summary: text('summary').notNull(),
		evidenceTradeIds: text('evidence_trade_ids', { mode: 'json' }).$type<string[]>(),
		stat: text('stat', { mode: 'json' }).$type<{ pValue?: number; sampleSize?: number }>(),
		dismissedAt: integer('dismissed_at'),
		createdAt: createdAt()
	},
	(t) => [index('ai_insight_user_idx').on(t.userId)]
);

export const dashboardLayout = sqliteTable('dashboard_layout', {
	id: pk(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull().default('Default'),
	widgets: text('widgets', { mode: 'json' }).$type<unknown[]>(),
	isDefault: integer('is_default', { mode: 'boolean' }).notNull().default(false),
	createdAt: createdAt()
});

export const savedView = sqliteTable(
	'saved_view',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		screen: text('screen').notNull(),
		name: text('name').notNull(),
		filters: text('filters', { mode: 'json' }).$type<Record<string, unknown>>(),
		createdAt: createdAt()
	},
	(t) => [index('saved_view_user_screen_idx').on(t.userId, t.screen)]
);

export * from './auth.schema';
