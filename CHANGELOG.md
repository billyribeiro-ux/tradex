# Changelog

A public, honest changelog is a core TradeX value — reliability is a feature.

## [Unreleased] — MVP foundation

### Added

- **Project foundation (Phase 0).** SvelteKit 2.67 + Svelte 5 (runes), Vite 8, TypeScript 6 in
  **strict mode** (`noUncheckedIndexedAccess`, `noImplicitOverride`). Node 24 LTS target, pnpm 11.
  Dual-build adapter seam (`adapter-node` for web, `adapter-static` for the future Tauri desktop)
  selected via the `ADAPTER` env var.
- **Money engine** (`$lib/money`) — scaled-integer (1e8) arithmetic with BigInt intermediates; no
  binary-float drift, Rust `i64`-portable. (11 tests)
- **Database** — Drizzle ORM on **Postgres** (Neon in production; in-process **PGlite** for local
  dev and tests, so no DB server is needed locally). Full 26-table schema covering all asset classes;
  money/price/qty as scaled `bigint` (1e8), time as UTC epoch ms. Migrations are committed under
  `drizzle/` (the portability contract for the future Rust/sqlx backend). Driver auto-selected from
  `DATABASE_URL` (`postgres://…` → Neon; otherwise PGlite).
- **Trade grouping engine** (`$lib/domain/grouping`) — pure executions → round-trip trades:
  scale-in/out, partial fills, reversals, pro-rata fees, shorts, multipliers, open positions.
  (13 tests)
- **Metrics + transparent TradeX Score** (`$lib/domain/metrics`) — win rate, profit factor,
  expectancy, max drawdown, recovery factor, consistency, streaks, equity curve, R-multiple, and a
  published-weight 0–100 score with a visible factor breakdown. (12 tests)
- **Forgiving CSV import** (`$lib/domain/csv-mapping` + `services/import`) — fuzzy column
  auto-detection, messy-value normalization (BOT/SLD, `1,234.50`, parentheses-negatives), per-row
  error reporting that never discards the whole file, and idempotent re-import via execution dedupe
  hash. (12 unit + integration tests)
- **Auth** — Better Auth (email + password, GitHub/Google OAuth) on database-backed sessions.
- **App** — authenticated shell with account switcher; Dashboard (KPIs, TradeX Score gauge, equity
  curve, P&L calendar heatmap, recent trades); Trades log with filters; Trade detail with executions
  and a journal/plan editor that recomputes R-multiple; manual trade entry; CSV import with an error
  report; multi-account management (ungated); analytics breakdowns; calendar; CSV/JSON export
  (no lock-in); settings.
- **AI Coach** — bring-your-own Anthropic key, **AES-256-GCM encrypted at rest**; `/coach` sends the
  account's computed stats + recent closed trades to Claude (default `claude-sonnet-4-6`, with
  Opus 4.8 / Haiku 4.5 selectable) for evidence-based, small-sample-flagged insights. Settings page
  to manage the key.
- **AI Coach — NL→SQL** ("Run as query"): plain-English questions become a read-only `SELECT` over a
  documented `trades` view, **the generated SQL is shown**, and it runs in a throwaway in-process
  PGlite sandbox seeded with ONLY the current account's trades — cross-tenant leakage is structurally
  impossible, with extra validation blocking writes/DDL/multi-statement/comments. (6 tests.)
- **Playbooks** — define strategies with entry criteria + risk rules (`/playbooks`), assign one to a
  trade from the trade detail, and see per-playbook performance (net P&L, win rate, profit factor,
  trade count) across all accounts. Feeds the TradeX Score's rule-adherence factor.
- **Risk & validation** (`/risk`) — **Monte Carlo edge validation** (reproducible resampling of your
  own per-trade returns → probability of profit, **probability of ruin**, terminal P&L percentiles,
  drawdown distribution) and a **prop-firm rule monitor** (profit target, daily-loss limit,
  static/trailing max drawdown, min trading days, consistency) with live pass/breach status and an
  editable per-account config. (10 tests.)
- **Journal** (`/journal`) — date-based free-form review notes with a running feed and delete.
- **Categorization** — free-text Setup, Emotion, and comma-separated Tags on the trade detail,
  created on demand (race-safe find-or-create), so trades can be sliced by setup/tag/emotion.
- **PWA** — installable (manifest + brand icon), offline app-shell service worker (precaches the
  built shell; never caches auth-sensitive HTML/API).
- **Desktop (Tauri 2)** — `src-tauri/` shell (resolves to `tauri` 2.11.3, Cargo.lock committed,
  icon set generated); `pnpm tauri:dev` wraps the live app, `pnpm tauri:build` packages the
  `ADAPTER=static` SPA. (Offline data layer lands with Phase 3/4.)
- **Tests** — 103 unit/integration passing + a 10-case Playwright E2E suite (happy-path plus feature
  coverage: trade CRUD, export, multi-tenant isolation, accounts, coach states, playbooks, trade
  metadata capture, analytics drill-down, category management, share links, and the import mapper),
  wired into CI alongside lint, typecheck, build, and a screenshot-capture job. CI via GitHub Actions.

### Fixed (correctness audit)

- **Timezone integrity, end to end.** Accounts now have a timezone picker (create + edit); CSV import
  interprets naive broker timestamps in that zone instead of stamping them UTC (DST-correct), and
  tz-named strings like "… EDT" are no longer mis-parsed; the calendar view buckets days in the
  account zone like the dashboard already did. Previously every account was silently UTC.
- **Forgiving import, hardened.** Reject non-positive prices (were only null-checked); per-row errors
  now name the offending column; 10 MB / 100k-row guardrails return a friendly error instead of
  risking a memory/timeout DoS.
- **Prop-firm engine.** Removed the unimplemented "EOD" drawdown type that silently behaved as
  static; the consistency rule stays visible (not dropped) before an account is net-profitable.
- **Trade entry.** Capture setup, emotion, tags and a playbook at logging time (no detour to the
  detail page); require exit price and exit time together so a lone exit can't silently log an open
  trade.
- **Display.** Trade log honours the account's base currency (was hardcoded USD); dashboard shows
  "avg win / —" when there are no losses.

### Added (Phase-2 features)

- **Tag / setup / emotion management** (`/categories`, linked from Settings) — list each with a usage
  count, rename in place, **merge** by renaming onto an existing name (re-points every trade, no
  double-counting), and delete. All actions are userId-scoped.
- **Read-only trade share links** — a trade detail page mints an unguessable `/share/<token>` that
  renders a clean public view of that one trade (no auth; the token is the credential), with privacy
  scopes to hide position size and/or dollar P&L (R-multiple still shown) and an optional 7/30-day
  expiry. Create, copy and revoke from the trade; the public page is `no-store` + `noindex`.
- **Interactive CSV column mapper + saved per-broker templates** — upload now previews into a
  per-field column picker with a live sample preview; the confirmed mapping imports, and can be
  **saved as a template** (name + broker) and reused later via a selector. The industry's #1 import
  pain, made forgiving.
- **Options — single-leg** (`$lib/domain/options` + `services/instruments`) — an option's identity is
  its `(underlying, expiry, type, strike)`, so each contract maps to its own instrument (×100
  multiplier) with a structured `option_contract` row; different strikes/expiries never net together.
  Manual entry captures call/put + strike + expiry; OCC symbols (`AAPL240920C00190000`) are recognised
  on CSV import and normalised to a canonical label (`AAPL 190C 20SEP24`); the trade detail shows DTE,
  break-even and the multiplier. (8 unit + 5 integration tests.)
- **Options — multi-leg structures** (`$lib/domain/spreads` + `services/spreads`) — log a spread as a
  set of legs on one underlying (`/trades/spread/new`, with vertical/straddle/strangle/iron-condor
  quick-starts and a live preview). TradeX **classifies the structure** (bull/bear call & put
  verticals, straddles, strangles, calendars, diagonals, iron condors/butterflies, butterflies) and
  derives its **net debit/credit and defined max profit / max loss** from the legs — purely, so it's
  exhaustively unit-tested. Each leg is its own multiplier-correct option trade bound to a shared
  group; the structure page rolls up realized P&L and links each leg, and re-importing a leg's
  contract preserves the grouping. (22 unit + 5 integration + e2e tests.)
- **Options — payoff diagram & break-evens.** Every single-expiry structure renders a P&L-at-expiry
  curve (SVG, shaded profit/loss zones, strike ticks, break-even markers) on its page, and the
  break-even price(s) appear both there and live on the entry-form preview. The payoff and
  break-evens are computed purely from the legs (piecewise-linear with exact zero-crossings) and are
  intentionally suppressed for calendars/diagonals, where an at-expiry curve would mislead.
  (7 added unit tests.)

### Changed

- **Analytics & calendar drill-down.** Symbol/asset-class bars and calendar day cells now link into a
  filtered trade log (by `?symbol` / `?assetClass` / `?date`), with an active-filter chip.
- Landing copy no longer advertises MFE/MAE (true excursion needs an intrabar price feed the app
  doesn't ingest yet; the schema columns remain reserved).

### Deferred (next phases)

- MFE/MAE + exit-efficiency (need an intrabar/tick price feed); AI-insight persistence; saved
  dashboard views. (Schema is already in place for these.)

- JWT/JWKS + bearer auth (added in Phase 3 for the Rust/Axum API and Tauri desktop).
- Aggregate multi-leg analytics (per-strategy win rate / expectancy); alt-exit backtest simulation.
- Per-trade candlestick chart with entry/exit markers (needs market price history).
- Virtualized trade table (currently server-paginated), interactive CSV column-mapper UI.
- Rust + Axum backend (Phase 3); then the Tauri shell's offline data layer via embedded DB + Neon
  sync (Phase 4) — the desktop shell itself already exists in `src-tauri/`.
