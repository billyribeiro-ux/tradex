import {
	pgTable,
	text,
	bigint,
	integer,
	boolean,
	jsonb,
	index,
	uniqueIndex,
	primaryKey
} from 'drizzle-orm/pg-core';
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
 * - money / price / quantity / multiplier: bigint scaled by 1e8 (see $lib/money)
 * - timestamps / durations: bigint UTC epoch milliseconds
 *   (bigint avoids the int4 overflow scaled money would hit; mode:'number' keeps
 *   exact values well within Number.MAX_SAFE_INTEGER for realistic magnitudes.)
 */
const pk = () =>
	text('id')
		.primaryKey()
		.$defaultFn(() => crypto.randomUUID());
const money = (name: string) => bigint(name, { mode: 'number' });
const ts = (name: string) => bigint(name, { mode: 'number' });
const createdAt = () =>
	bigint('created_at', { mode: 'number' })
		.notNull()
		.$defaultFn(() => Date.now());
const updatedAt = () =>
	bigint('updated_at', { mode: 'number' })
		.notNull()
		.$defaultFn(() => Date.now())
		.$onUpdate(() => Date.now());

// ---------------------------------------------------------------------------
// User settings (1:1 with Better Auth user)
// ---------------------------------------------------------------------------
export const userSettings = pgTable('user_settings', {
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
export const tradingAccount = pgTable(
	'trading_account',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		broker: text('broker'),
		assetClasses: jsonb('asset_classes').$type<AssetClass[]>().notNull().default(['stock']),
		baseCurrency: text('base_currency').notNull().default('USD'),
		startingBalance: money('starting_balance').notNull().default(0),
		timezone: text('timezone').notNull().default('UTC'),
		isPropFirm: boolean('is_prop_firm').notNull().default(false),
		createdAt: createdAt(),
		archivedAt: ts('archived_at')
	},
	(t) => [index('trading_account_user_idx').on(t.userId)]
);

// ---------------------------------------------------------------------------
// Instruments (global reference data)
// ---------------------------------------------------------------------------
export const instrument = pgTable(
	'instrument',
	{
		id: pk(),
		symbol: text('symbol').notNull(),
		assetClass: text('asset_class').$type<AssetClass>().notNull(),
		exchange: text('exchange'),
		name: text('name'),
		multiplier: money('multiplier').notNull().default(SCALE),
		tickSize: money('tick_size'),
		currency: text('currency').notNull().default('USD')
	},
	(t) => [uniqueIndex('instrument_symbol_class_idx').on(t.symbol, t.assetClass)]
);

export const optionContract = pgTable(
	'option_contract',
	{
		id: pk(),
		underlyingInstrumentId: text('underlying_instrument_id')
			.notNull()
			.references(() => instrument.id, { onDelete: 'cascade' }),
		type: text('type').$type<OptionType>().notNull(),
		strike: money('strike').notNull(),
		expiry: ts('expiry').notNull(),
		multiplier: money('multiplier')
			.notNull()
			.default(100 * SCALE)
	},
	(t) => [index('option_contract_underlying_idx').on(t.underlyingInstrumentId)]
);

// ---------------------------------------------------------------------------
// Multi-leg groups (option structures: vertical, condor, ...)
// ---------------------------------------------------------------------------
export const multiLegGroup = pgTable('multi_leg_group', {
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
export const execution = pgTable(
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
		qty: money('qty').notNull(),
		price: money('price').notNull(),
		fee: money('fee').notNull().default(0),
		commission: money('commission').notNull().default(0),
		executedAt: ts('executed_at').notNull(),
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
export const tag = pgTable(
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

export const setup = pgTable(
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

export const emotion = pgTable(
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

export const playbook = pgTable(
	'playbook',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		description: text('description'),
		rules: jsonb('rules').$type<PlaybookRules>(),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('playbook_user_name_idx').on(t.userId, t.name)]
);

// ---------------------------------------------------------------------------
// Trades (derived from executions)
// ---------------------------------------------------------------------------
export const trade = pgTable(
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
		openedAt: ts('opened_at').notNull(),
		closedAt: ts('closed_at'),
		qtyOpened: money('qty_opened').notNull().default(0),
		qtyClosed: money('qty_closed').notNull().default(0),
		avgEntry: money('avg_entry').notNull().default(0),
		avgExit: money('avg_exit'),
		grossPnl: money('gross_pnl').notNull().default(0),
		netPnl: money('net_pnl').notNull().default(0),
		fees: money('fees').notNull().default(0),
		rMultiple: money('r_multiple'),
		riskAmount: money('risk_amount'),
		mfe: money('mfe'),
		mae: money('mae'),
		exitEfficiency: money('exit_efficiency'),
		holdMs: ts('hold_ms'),
		setupId: text('setup_id').references(() => setup.id, { onDelete: 'set null' }),
		playbookId: text('playbook_id').references(() => playbook.id, { onDelete: 'set null' }),
		emotionId: text('emotion_id').references(() => emotion.id, { onDelete: 'set null' }),
		confidence: integer('confidence'),
		plannedEntry: money('planned_entry'),
		plannedStop: money('planned_stop'),
		plannedTarget: money('planned_target'),
		plannedQty: money('planned_qty'),
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

export const tradeExecution = pgTable(
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

export const tradeTag = pgTable(
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
export const propFirmConfig = pgTable(
	'prop_firm_config',
	{
		id: pk(),
		accountId: text('account_id')
			.notNull()
			.references(() => tradingAccount.id, { onDelete: 'cascade' }),
		firm: text('firm').$type<PropFirm>().notNull(),
		profitTarget: money('profit_target'),
		dailyLossLimit: money('daily_loss_limit'),
		maxDrawdown: money('max_drawdown'),
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
export const journalEntry = pgTable(
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

export const attachment = pgTable('attachment', {
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
export const importMappingTemplate = pgTable('import_mapping_template', {
	id: pk(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	broker: text('broker').notNull(),
	name: text('name').notNull(),
	assetClass: text('asset_class').$type<AssetClass>(),
	columnMap: jsonb('column_map').$type<Record<string, string>>().notNull(),
	createdAt: createdAt()
});

export const importBatch = pgTable(
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
export const shareLink = pgTable(
	'share_link',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		tradeId: text('trade_id').references(() => trade.id, { onDelete: 'cascade' }),
		token: text('token').notNull(),
		scope: jsonb('scope').$type<{ hideSize?: boolean; hidePnl?: boolean }>(),
		expiresAt: ts('expires_at'),
		createdAt: createdAt()
	},
	(t) => [uniqueIndex('share_link_token_idx').on(t.token)]
);

export const aiInsight = pgTable(
	'ai_insight',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		accountId: text('account_id').references(() => tradingAccount.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		summary: text('summary').notNull(),
		evidenceTradeIds: jsonb('evidence_trade_ids').$type<string[]>(),
		stat: jsonb('stat').$type<{ pValue?: number; sampleSize?: number }>(),
		dismissedAt: ts('dismissed_at'),
		createdAt: createdAt()
	},
	(t) => [index('ai_insight_user_idx').on(t.userId)]
);

export const dashboardLayout = pgTable('dashboard_layout', {
	id: pk(),
	userId: text('user_id')
		.notNull()
		.references(() => user.id, { onDelete: 'cascade' }),
	name: text('name').notNull().default('Default'),
	widgets: jsonb('widgets').$type<unknown[]>(),
	isDefault: boolean('is_default').notNull().default(false),
	createdAt: createdAt()
});

export const savedView = pgTable(
	'saved_view',
	{
		id: pk(),
		userId: text('user_id')
			.notNull()
			.references(() => user.id, { onDelete: 'cascade' }),
		screen: text('screen').notNull(),
		name: text('name').notNull(),
		filters: jsonb('filters').$type<Record<string, unknown>>(),
		createdAt: createdAt()
	},
	(t) => [index('saved_view_user_screen_idx').on(t.userId, t.screen)]
);

export * from './auth.schema';
