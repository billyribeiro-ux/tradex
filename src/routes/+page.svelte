<script lang="ts">
	import {
		ChartLineUp,
		Stack,
		Gauge,
		CalendarBlank,
		ShieldCheck,
		Sparkle,
		ArrowRight
	} from 'phosphor-svelte';
	import { reveal } from '$lib/motion';
	// Lazy-loaded so three.js/threlte isn't shipped to every landing visitor.
	const hero3d = import('$lib/components/three/Hero3D.svelte');

	const features = [
		{
			icon: Stack,
			title: 'Executions → trades',
			body: 'Drop in a broker CSV and TradeX groups raw fills into round-trip trades automatically — partials, scale-ins and reversals included.'
		},
		{
			icon: Gauge,
			title: 'Transparent TradeX Score',
			body: 'One number for your process quality — and every input is shown, so you know exactly why it moved.'
		},
		{
			icon: ChartLineUp,
			title: 'Metrics that matter',
			body: 'Win rate, profit factor, expectancy, R-multiple, MFE/MAE and a live equity curve — computed in integer money, no float drift.'
		},
		{
			icon: CalendarBlank,
			title: 'Calendar heatmap',
			body: 'See your P&L by day at a glance and spot the patterns in when you trade well — and when you should sit out.'
		},
		{
			icon: ShieldCheck,
			title: 'Risk & prop-firm guardrails',
			body: 'Monte-Carlo edge validation plus daily-loss, drawdown and consistency checks for FTMO, Topstep, Apex and more.'
		},
		{
			icon: Sparkle,
			title: 'AI Coach',
			body: 'Bring your own Claude key and ask plain-English questions about your trading — grounded in your real numbers, with the SQL shown.'
		}
	];

	const stats = [
		{ label: 'Net P&L', value: '+$8,420', tone: 'var(--color-up)' },
		{ label: 'Win rate', value: '57%', tone: 'var(--color-text)' },
		{ label: 'Profit factor', value: '1.94', tone: 'var(--color-text)' },
		{ label: 'TradeX Score', value: '78', tone: 'var(--color-brand)' }
	];

	const steps = [
		{
			n: '1',
			t: 'Import',
			d: 'Upload a CSV from your broker or log trades by hand. Duplicates are caught automatically.'
		},
		{
			n: '2',
			t: 'Review',
			d: 'See your dashboard, calendar, equity curve and per-setup performance update instantly.'
		},
		{
			n: '3',
			t: 'Improve',
			d: 'Journal the why, follow your playbooks, and let the coach surface your real edge.'
		}
	];
</script>

<svelte:head>
	<title>TradeX — the trading journal that does the analysis for you</title>
	<meta
		name="description"
		content="TradeX turns your broker fills into trades, scores your process, and helps you find your edge — with risk guardrails and an AI coach."
	/>
</svelte:head>

<div class="min-h-dvh">
	<header class="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
		<a href="/" class="flex items-center gap-2 text-xl font-bold">
			<span style="color:var(--color-brand)">Trade</span><span>X</span>
		</a>
		<nav class="flex items-center gap-3">
			<a href="/login" class="btn btn-ghost">Log in</a>
			<a href="/signup" class="btn btn-primary">Get started</a>
		</nav>
	</header>

	<main>
		<!-- Hero with live 3D data-surface backdrop -->
		<section class="relative overflow-hidden">
			<div class="absolute inset-0" style="height:760px">
				{#await hero3d then { default: Hero3D }}
					<Hero3D />
				{/await}
				<!-- legibility scrim -->
				<div
					class="absolute inset-0"
					style="background:linear-gradient(180deg, rgba(7,10,17,0.35) 0%, rgba(7,10,17,0.6) 55%, var(--color-bg) 100%)"
				></div>
			</div>

			<div class="relative z-10 mx-auto max-w-6xl px-6 pt-12 pb-16 text-center sm:pt-24">
				<span
					class="chip"
					use:reveal={{ delay: 0.05, y: 8 }}
					style="background:rgba(20,224,163,0.08);color:var(--color-muted)"
				>
					<span style="color:var(--color-brand)">●</span> Built for serious, self-improving traders
				</span>

				<h1
					class="mx-auto mt-6 max-w-3xl text-4xl font-bold tracking-tight sm:text-6xl"
					use:reveal={{ delay: 0.12 }}
				>
					The trading journal that does the
					<span style="color:var(--color-brand)">analysis</span> for you.
				</h1>

				<p
					class="mx-auto mt-5 max-w-2xl text-lg"
					style="color:var(--color-muted)"
					use:reveal={{ delay: 0.2 }}
				>
					Import your fills, and TradeX groups them into trades, computes your real stats, scores
					your process, and shows you where your edge actually is.
				</p>

				<div
					class="mt-8 flex flex-wrap items-center justify-center gap-3"
					use:reveal={{ delay: 0.28 }}
				>
					<a href="/signup" class="btn btn-primary px-5 py-3 text-base">
						Start journaling free <ArrowRight size={18} weight="bold" />
					</a>
					<a href="/login" class="btn btn-ghost px-5 py-3 text-base">I already have an account</a>
				</div>

				<!-- Live KPI strip -->
				<div class="panel mx-auto mt-16 max-w-4xl p-2" use:reveal={{ delay: 0.36 }}>
					<div class="grid grid-cols-2 gap-2 sm:grid-cols-4">
						{#each stats as s (s.label)}
							<div class="rounded-lg p-5 text-left" style="background:var(--color-bg-2)">
								<div class="label">{s.label}</div>
								<div class="kpi-val mono mt-1" style="color:{s.tone}">{s.value}</div>
							</div>
						{/each}
					</div>
				</div>
			</div>
		</section>

		<!-- Features -->
		<section class="mx-auto max-w-6xl px-6 py-12">
			<h2 class="text-center text-2xl font-bold sm:text-3xl">Everything in one place</h2>
			<p class="mx-auto mt-3 max-w-xl text-center" style="color:var(--color-muted)">
				From raw broker data to a clear answer on what to do more of — and what to stop.
			</p>

			<div class="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
				{#each features as f (f.title)}
					<div class="card p-6">
						<div
							class="flex h-11 w-11 items-center justify-center rounded-lg"
							style="background:var(--color-surface-2);color:var(--color-brand)"
						>
							<f.icon size={22} weight="duotone" />
						</div>
						<h3 class="mt-4 font-semibold">{f.title}</h3>
						<p class="mt-2 text-sm" style="color:var(--color-muted)">{f.body}</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- How it works -->
		<section class="mx-auto max-w-6xl px-6 py-12">
			<div class="grid gap-4 sm:grid-cols-3">
				{#each steps as step (step.n)}
					<div class="card p-6">
						<div class="text-3xl font-bold" style="color:var(--color-brand)">{step.n}</div>
						<h3 class="mt-2 font-semibold">{step.t}</h3>
						<p class="mt-2 text-sm" style="color:var(--color-muted)">{step.d}</p>
					</div>
				{/each}
			</div>
		</section>

		<!-- CTA -->
		<section class="mx-auto max-w-6xl px-6 py-16 text-center">
			<div class="card p-10">
				<h2 class="text-2xl font-bold sm:text-3xl">Find your edge.</h2>
				<p class="mx-auto mt-3 max-w-xl" style="color:var(--color-muted)">
					Your data stays yours. Start with a CSV and a few minutes.
				</p>
				<a href="/signup" class="btn btn-primary mt-6 px-5 py-3 text-base">
					Create your journal <ArrowRight size={18} weight="bold" />
				</a>
			</div>
		</section>
	</main>

	<footer
		class="mx-auto flex max-w-6xl flex-col items-center justify-between gap-3 px-6 py-8 text-sm sm:flex-row"
		style="color:var(--color-muted)"
	>
		<div class="flex items-center gap-2 font-bold">
			<span style="color:var(--color-brand)">Trade</span><span>X</span>
		</div>
		<div>Trade journaling, analytics &amp; coaching.</div>
	</footer>
</div>
