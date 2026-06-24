# TradeX

A state-of-the-art trade journaling app — built to implement every table-stakes feature of the best
journals (TradeZella, Tradervue, Edgewonk, TraderSync, TradesViz, …) and beat them where they all
fail: a **correct, forgiving import + grouping engine**, **transparent metrics**, **full data
export (no lock-in)**, and a roadmap to a **local-first offline desktop app**.

## Stack (pinned, latest as of June 2026)

- **Frontend:** SvelteKit 2.67 · Svelte 5 (runes) · Vite 8 · TypeScript 6 (strict) · Tailwind CSS 4
- **Icons / charts:** phosphor-svelte · lightweight-charts (equity curve) · hand-rolled SVG calendar
- **Data:** Drizzle ORM + libSQL/SQLite (local file → Turso) · Zod validation
- **Auth:** Better Auth (sessions; email/password + GitHub/Google OAuth)
- **Tooling:** pnpm 11 · Node 24 LTS · Vitest 4 · Playwright 1.61
- **Planned:** Rust + Axum backend (Phase 3) · Tauri 2 desktop, offline + Turso sync (Phase 4)

## Architecture seam

All DB access and business logic live in `src/lib/server`. The engines — grouping, metrics, score,
CSV mapping — are **pure and framework-agnostic** (`src/lib/domain`), and services take the Drizzle
client by dependency injection. Money is stored as scaled integers (1e8) and time as UTC epoch ms, so
the future Rust backend (i64) agrees byte-for-byte. Drizzle migrations are committed so Rust (sqlx)
can open the identical database. This keeps a clean swap point for the Rust/Axum API and Tauri.

## Develop

Requires Node 24 (`.node-version`) and pnpm 11 (Corepack).

```sh
corepack enable
pnpm install
pnpm db:migrate        # creates local.db from committed migrations
pnpm dev               # http://localhost:5173
```

Scripts: `pnpm check` (svelte-check), `pnpm test:unit` (Vitest), `pnpm build` (adapter-node).
Build the desktop SPA target with `ADAPTER=static pnpm build`.

See `CHANGELOG.md` for what's shipped and what's deferred.
