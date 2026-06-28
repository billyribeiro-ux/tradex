<script lang="ts">
	import { enhance } from '$app/forms';
	import { classifySpread, spreadRisk, type SpreadLeg } from '$lib/domain/spreads';
	import { toScaled, formatMoney } from '$lib/money';
	import { Plus, Trash } from 'phosphor-svelte';

	let { data, form } = $props();

	type LegForm = {
		type: 'call' | 'put';
		side: 'buy' | 'sell';
		strike: string;
		expiry: string;
		qty: string;
		entry: string;
		exit: string;
	};

	const blankLeg = (over: Partial<LegForm> = {}): LegForm => ({
		type: 'call',
		side: 'buy',
		strike: '',
		expiry: '',
		qty: '1',
		entry: '',
		exit: '',
		...over
	});

	let underlying = $state('');
	let legs = $state<LegForm[]>([blankLeg({ side: 'buy' }), blankLeg({ side: 'sell' })]);

	function addLeg() {
		if (legs.length < 6) legs.push(blankLeg());
	}
	function removeLeg(i: number) {
		if (legs.length > 2) legs.splice(i, 1);
	}

	/** Prefill the leg grid with a common structure's shape (strikes/premiums left blank). */
	function preset(kind: 'vertical' | 'straddle' | 'strangle' | 'condor') {
		if (kind === 'vertical') {
			legs = [blankLeg({ type: 'call', side: 'buy' }), blankLeg({ type: 'call', side: 'sell' })];
		} else if (kind === 'straddle') {
			legs = [blankLeg({ type: 'call', side: 'buy' }), blankLeg({ type: 'put', side: 'buy' })];
		} else if (kind === 'strangle') {
			legs = [blankLeg({ type: 'call', side: 'sell' }), blankLeg({ type: 'put', side: 'sell' })];
		} else {
			legs = [
				blankLeg({ type: 'put', side: 'buy' }),
				blankLeg({ type: 'put', side: 'sell' }),
				blankLeg({ type: 'call', side: 'sell' }),
				blankLeg({ type: 'call', side: 'buy' })
			];
		}
	}

	function dateToMs(d: string): number | null {
		if (!d) return null;
		const [y, m, day] = d.split('-').map(Number);
		if (!y || !m || !day) return null;
		return Date.UTC(y, m - 1, day);
	}

	// Live preview: classify the structure and derive its risk the instant the
	// legs are complete enough — same pure functions the server records with.
	const parsedLegs = $derived(
		legs
			.map((l): SpreadLeg | null => {
				const strike = Number(l.strike);
				const qty = Number(l.qty);
				const entry = Number(l.entry);
				const expiry = dateToMs(l.expiry);
				if (!l.strike || !(strike > 0) || !(qty > 0) || expiry == null || l.entry === '')
					return null;
				return {
					type: l.type,
					side: l.side,
					strike: toScaled(strike),
					expiry,
					qty: toScaled(qty),
					entryPremium: toScaled(entry)
				};
			})
			.filter((l): l is SpreadLeg => l !== null)
	);
	const preview = $derived(
		parsedLegs.length === legs.length && legs.length >= 2
			? { cls: classifySpread(parsedLegs), risk: spreadRisk(parsedLegs) }
			: null
	);
</script>

<svelte:head><title>New spread · TradeX</title></svelte:head>

<header class="mb-5">
	<a href="/trades/new" class="text-sm" style="color:var(--color-muted)">← Single trade</a>
	<h1 class="mt-1 text-2xl font-bold">Log a multi-leg spread</h1>
	<p class="text-sm" style="color:var(--color-muted)">
		Each leg is an option contract on the same underlying. TradeX classifies the structure and
		computes net debit/credit and defined risk automatically.
	</p>
</header>

{#if !data.supportsOptions}
	<div class="panel mb-4 p-4 text-sm" style="color:var(--color-muted)">
		This account isn't set up for options. You can still record the spread, but enable
		<strong>Options</strong> in
		<a href="/accounts" style="color:var(--color-brand)">account settings</a>
		to see it in option analytics.
	</div>
{/if}

<form method="POST" use:enhance class="card max-w-3xl p-6">
	<div class="grid grid-cols-2 gap-4 sm:grid-cols-3">
		<div>
			<label class="label" for="underlying">Underlying</label>
			<input
				id="underlying"
				name="underlying"
				class="input mt-1"
				bind:value={underlying}
				placeholder="AAPL"
			/>
		</div>
		<div>
			<label class="label" for="entryAt">Entry time (UTC)</label>
			<input id="entryAt" name="entryAt" class="input mt-1" type="datetime-local" />
		</div>
		<div>
			<label class="label" for="exitAt">Exit time (UTC)</label>
			<input id="exitAt" name="exitAt" class="input mt-1" type="datetime-local" />
		</div>
	</div>

	<div class="mt-5 flex flex-wrap items-center gap-2">
		<span class="label">Quick start</span>
		<button type="button" class="btn btn-ghost text-xs" onclick={() => preset('vertical')}
			>Vertical</button
		>
		<button type="button" class="btn btn-ghost text-xs" onclick={() => preset('straddle')}
			>Straddle</button
		>
		<button type="button" class="btn btn-ghost text-xs" onclick={() => preset('strangle')}
			>Strangle</button
		>
		<button type="button" class="btn btn-ghost text-xs" onclick={() => preset('condor')}
			>Iron condor</button
		>
	</div>

	<div class="mt-3 overflow-x-auto">
		<table class="dtable min-w-[44rem]">
			<thead>
				<tr>
					<th>Side</th>
					<th>Type</th>
					<th>Strike</th>
					<th>Expiry</th>
					<th>Qty</th>
					<th>Entry</th>
					<th>Exit</th>
					<th></th>
				</tr>
			</thead>
			<tbody>
				{#each legs as leg, i (i)}
					<tr>
						<td>
							<select name="legSide" class="input py-1" bind:value={leg.side} aria-label="Side">
								<option value="buy">Buy</option>
								<option value="sell">Sell</option>
							</select>
						</td>
						<td>
							<select name="legType" class="input py-1" bind:value={leg.type} aria-label="Type">
								<option value="call">Call</option>
								<option value="put">Put</option>
							</select>
						</td>
						<td>
							<input
								name="legStrike"
								class="input w-20 py-1"
								inputmode="decimal"
								bind:value={leg.strike}
								placeholder="190"
								aria-label="Strike"
							/>
						</td>
						<td>
							<input
								name="legExpiry"
								class="input py-1"
								type="date"
								bind:value={leg.expiry}
								aria-label="Expiry"
							/>
						</td>
						<td>
							<input
								name="legQty"
								class="input w-16 py-1"
								inputmode="decimal"
								bind:value={leg.qty}
								aria-label="Quantity"
							/>
						</td>
						<td>
							<input
								name="legEntry"
								class="input w-20 py-1"
								inputmode="decimal"
								bind:value={leg.entry}
								placeholder="5.00"
								aria-label="Entry premium"
							/>
						</td>
						<td>
							<input
								name="legExit"
								class="input w-20 py-1"
								inputmode="decimal"
								bind:value={leg.exit}
								placeholder="—"
								aria-label="Exit premium"
							/>
						</td>
						<td>
							<button
								type="button"
								class="btn btn-ghost px-2 py-1"
								style="color:var(--color-down)"
								disabled={legs.length <= 2}
								onclick={() => removeLeg(i)}
								aria-label="Remove leg"
							>
								<Trash size={14} />
							</button>
						</td>
					</tr>
				{/each}
			</tbody>
		</table>
	</div>

	<button
		type="button"
		class="btn btn-ghost mt-2 text-xs"
		onclick={addLeg}
		disabled={legs.length >= 6}
	>
		<Plus size={14} /> Add leg
	</button>

	{#if preview}
		<div
			class="mt-4 grid grid-cols-2 gap-3 rounded-lg p-4 sm:grid-cols-4"
			style="background:var(--color-surface-2)"
		>
			<div class="sm:col-span-4">
				<span class="label">Structure</span>
				<div class="mt-0.5 text-lg font-bold" style="color:var(--color-brand)">
					{preview.cls.label}
				</div>
			</div>
			<div>
				<span class="label">{preview.risk.kind === 'credit' ? 'Net credit' : 'Net debit'}</span>
				<div class="mono mt-0.5 font-semibold">
					{formatMoney(Math.abs(preview.risk.net))}
				</div>
			</div>
			<div>
				<span class="label">Max profit</span>
				<div class="mono mt-0.5 font-semibold" style="color:var(--color-up)">
					{preview.risk.maxProfit != null ? formatMoney(preview.risk.maxProfit) : 'Unlimited'}
				</div>
			</div>
			<div>
				<span class="label">Max loss</span>
				<div class="mono mt-0.5 font-semibold" style="color:var(--color-down)">
					{preview.risk.maxLoss != null ? formatMoney(preview.risk.maxLoss) : 'Undefined'}
				</div>
			</div>
			<div>
				<span class="label">Legs</span>
				<div class="mono mt-0.5 font-semibold">{legs.length}</div>
			</div>
		</div>
	{/if}

	<div class="mt-4 grid grid-cols-2 gap-4 sm:grid-cols-4">
		<div>
			<label class="label" for="fees">Total fees</label>
			<input id="fees" name="fees" class="input mt-1" inputmode="decimal" placeholder="0" />
		</div>
		<div>
			<label class="label" for="confidence">Confidence (1–10)</label>
			<input id="confidence" name="confidence" class="input mt-1" type="number" min="1" max="10" />
		</div>
		<div>
			<label class="label" for="setupName">Setup</label>
			<input id="setupName" name="setupName" class="input mt-1" placeholder="e.g. IV crush" />
		</div>
		<div>
			<label class="label" for="emotionLabel">Emotion</label>
			<input id="emotionLabel" name="emotionLabel" class="input mt-1" placeholder="Calm" />
		</div>
	</div>

	<div class="mt-4 grid grid-cols-[1fr_12rem] gap-4">
		<div>
			<label class="label" for="notes">Notes</label>
			<input id="notes" name="notes" class="input mt-1" placeholder="Thesis, adjustments…" />
		</div>
		<div>
			<label class="label" for="playbookId">Playbook</label>
			<select id="playbookId" name="playbookId" class="input mt-1">
				<option value="">— none —</option>
				{#each data.playbooks as p (p.id)}
					<option value={p.id}>{p.name}</option>
				{/each}
			</select>
		</div>
	</div>

	{#if form?.message}<p class="mt-4 text-sm" style="color:var(--color-down)">{form.message}</p>{/if}

	<div class="mt-6 flex gap-3">
		<button type="submit" class="btn btn-primary">Save spread</button>
		<a href="/trades" class="btn btn-ghost">Cancel</a>
	</div>
</form>
