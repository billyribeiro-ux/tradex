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
  to manage the key. (Grounded Q&A shipped; NL→SQL query execution with shown SQL is next.)
- **Tests** — 53 passing (money, grouping, metrics, CSV mapping, and a full server integration test
  on in-memory Postgres: CSV → group → metrics → dashboard, idempotent re-import, reversal regroup).
  CI via GitHub Actions.

### Deferred (next phases)

- AI Coach **NL→SQL** querying with the generated SQL shown (read-only, account-scoped guardrails).
- JWT/JWKS + bearer auth (added in Phase 3 for the Rust/Axum API and Tauri desktop).
- Multi-leg options analytics, prop-firm rule monitor, Monte Carlo edge validation.
- Per-trade candlestick chart with entry/exit markers (needs market price history).
- Virtualized trade table (currently server-paginated), interactive CSV column-mapper UI.
- Rust + Axum backend (Phase 3) and Tauri 2 desktop with offline libSQL + Turso sync (Phase 4).
