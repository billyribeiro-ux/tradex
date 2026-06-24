<script lang="ts">
	import { enhance } from '$app/forms';
	import { Sparkle, PaperPlaneTilt, Database } from 'phosphor-svelte';

	let { data, form } = $props();
	let question = $state('');
	let loading = $state(false);

	type QueryForm = {
		question: string;
		sql: string;
		columns: string[];
		rows: Record<string, unknown>[];
		rowCount: number;
	};
	const qr = $derived(form && 'sql' in form && form.sql ? (form as unknown as QueryForm) : null);

	const prompts = [
		'What is my biggest leak right now?',
		'When during the week do I trade worst?',
		'Is my position sizing consistent?',
		'How disciplined am I about my stops?'
	];
</script>

<svelte:head><title>AI Coach · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="flex items-center gap-2 text-2xl font-bold">
		<Sparkle size={22} style="color:var(--color-brand)" weight="fill" /> AI Coach
	</h1>
	<p class="text-sm" style="color:var(--color-muted)">
		Grounded in your real stats — every insight is backed by your numbers, with small samples
		flagged.
	</p>
</header>

{#if !data.available}
	<div class="card p-8 text-center">
		<h2 class="text-lg font-semibold">Connect your Claude key</h2>
		<p class="mx-auto mt-2 max-w-md text-sm" style="color:var(--color-muted)">
			The coach uses your own Anthropic API key (stored encrypted). Add it in Settings to enable
			statistically-grounded behavioral analysis of your trading.
		</p>
		<a href="/settings" class="btn btn-primary mt-4">Add key in Settings</a>
	</div>
{:else}
	<div class="card p-5">
		<form
			method="POST"
			action="?/ask"
			use:enhance={() => {
				loading = true;
				return async ({ update }) => {
					await update({ reset: false });
					loading = false;
				};
			}}
		>
			<textarea
				name="question"
				rows="3"
				class="input"
				bind:value={question}
				placeholder="Ask about your edge, discipline, timing, sizing…"></textarea>
			<div class="mt-3 flex flex-wrap items-center gap-2">
				<button type="submit" class="btn btn-primary" disabled={loading}>
					<PaperPlaneTilt size={16} />
					{loading ? 'Thinking…' : 'Ask the coach'}
				</button>
				<button type="submit" formaction="?/query" class="btn btn-ghost" disabled={loading}>
					<Database size={16} /> Run as query
				</button>
				{#each prompts as p (p)}
					<button type="button" class="btn btn-ghost text-xs" onclick={() => (question = p)}
						>{p}</button
					>
				{/each}
			</div>
		</form>

		{#if form?.message}
			<p class="mt-4 text-sm" style="color:var(--color-down)">{form.message}</p>
		{/if}
		{#if form?.answer}
			<div class="mt-5 border-t pt-4" style="border-color:var(--color-border)">
				<p class="mb-2 text-sm font-medium" style="color:var(--color-muted)">{form.question}</p>
				<div class="text-sm whitespace-pre-wrap">{form.answer}</div>
			</div>
		{/if}
		{#if qr}
			<div class="mt-5 border-t pt-4" style="border-color:var(--color-border)">
				<p class="mb-2 text-sm font-medium" style="color:var(--color-muted)">{qr.question}</p>
				<pre
					class="overflow-x-auto rounded-lg p-3 text-xs"
					style="background:var(--color-surface-2)"><code>{qr.sql}</code></pre>
				<p class="mt-2 mb-2 text-xs" style="color:var(--color-muted)">{qr.rowCount} rows</p>
				{#if qr.rows.length > 0}
					<div class="overflow-x-auto rounded-lg" style="background:var(--color-surface-2)">
						<table class="w-full text-xs">
							<thead class="text-left" style="color:var(--color-muted)">
								<tr>
									{#each qr.columns as c (c)}<th class="p-2 font-medium">{c}</th>{/each}
								</tr>
							</thead>
							<tbody>
								{#each qr.rows as row, i (i)}
									<tr class="border-t" style="border-color:var(--color-border)">
										{#each qr.columns as c (c)}
											<td class="p-2 tabular-nums">{String(row[c] ?? '—')}</td>
										{/each}
									</tr>
								{/each}
							</tbody>
						</table>
					</div>
				{/if}
			</div>
		{/if}
	</div>

	<p class="mt-3 text-xs" style="color:var(--color-muted)">
		Insights reflect the current account's closed trades (needs ~30+ for reliable patterns).
		<strong>Run as query</strong> turns plain English into SQL — shown to you — run safely against an
		isolated copy of only your trades.
	</p>
{/if}
