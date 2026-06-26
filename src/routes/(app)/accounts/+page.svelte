<script lang="ts">
	import { enhance } from '$app/forms';
	import { ASSET_CLASSES, ASSET_CLASS_LABELS } from '$lib/domain/enums';
	import { formatMoney } from '$lib/money';
	import { Wallet, Trash } from 'phosphor-svelte';
	import { reveal } from '$lib/motion';

	let { data, form } = $props();
</script>

<svelte:head><title>Accounts · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Accounts</h1>
	<p class="mono mt-0.5 text-xs" style="color:var(--color-muted)">
		Track multiple brokerage or prop-firm accounts — never gated
	</p>
</header>

<div class="grid gap-3 lg:grid-cols-[1fr_22rem]">
	<div class="flex flex-col gap-3">
		{#each data.accounts as a, i (a.id)}
			<div class="panel p-4" use:reveal={{ delay: 0.05 * i }}>
				<div class="flex items-center justify-between">
					<div class="flex items-center gap-3">
						<div
							class="grid h-10 w-10 place-items-center rounded-lg"
							style="background:var(--color-surface-2)"
						>
							<Wallet size={20} style="color:var(--color-brand)" />
						</div>
						<div>
							<div class="font-semibold">{a.name}</div>
							<div class="mono text-xs" style="color:var(--color-faint)">
								{a.broker ?? 'No broker'} · {a.baseCurrency}
								{#if a.isPropFirm}· <span style="color:var(--color-accent)">prop firm</span>{/if}
							</div>
							<div class="mt-1 flex flex-wrap gap-1">
								{#each a.assetClasses as ac (ac)}
									<span class="chip">{ASSET_CLASS_LABELS[ac]}</span>
								{/each}
							</div>
						</div>
					</div>
					<div class="text-right">
						<div class="label">Starting</div>
						<div class="mono font-semibold">{formatMoney(a.startingBalance, a.baseCurrency)}</div>
						<a
							href="/dashboard?account={a.id}"
							class="mono text-xs"
							style="color:var(--color-brand)">Open →</a
						>
					</div>
				</div>

				<div
					class="mt-3 flex items-start gap-3 border-t pt-3"
					style="border-color:var(--color-hairline)"
				>
					<details class="flex-1">
						<summary class="mono cursor-pointer text-xs" style="color:var(--color-brand)"
							>Edit</summary
						>
						<form
							method="POST"
							action="?/update"
							use:enhance
							class="mt-2 grid gap-2 sm:grid-cols-2"
						>
							<input type="hidden" name="id" value={a.id} />
							<label class="flex flex-col gap-1"
								><span class="label">Name</span><input
									name="name"
									class="input"
									value={a.name}
								/></label
							>
							<label class="flex flex-col gap-1"
								><span class="label">Broker</span><input
									name="broker"
									class="input"
									value={a.broker ?? ''}
								/></label
							>
							<label class="flex flex-col gap-1"
								><span class="label">Currency</span><input
									name="baseCurrency"
									class="input"
									value={a.baseCurrency}
								/></label
							>
							<label class="flex flex-col gap-1"
								><span class="label">Starting balance</span><input
									name="startingBalance"
									class="input"
									inputmode="decimal"
									value={a.startingBalance / 1e8}
								/></label
							>
							<label class="flex flex-col gap-1 sm:col-span-2"
								><span class="label">Timezone</span><select name="timezone" class="input">
									{#each data.timezones as tz (tz)}
										<option value={tz} selected={tz === a.timezone}>{tz.replace('_', ' ')}</option>
									{/each}
								</select></label
							>
							<div class="sm:col-span-2">
								<div class="label mb-1">Asset classes</div>
								<div class="grid grid-cols-2 gap-1">
									{#each ASSET_CLASSES as ac (ac)}
										<label class="flex items-center gap-2 text-sm">
											<input
												type="checkbox"
												name="assetClasses"
												value={ac}
												checked={a.assetClasses.includes(ac)}
											/>
											{ASSET_CLASS_LABELS[ac]}
										</label>
									{/each}
								</div>
							</div>
							<label class="flex items-center gap-2 text-sm sm:col-span-2">
								<input type="checkbox" name="isPropFirm" checked={a.isPropFirm} /> Prop-firm account
							</label>
							<button type="submit" class="btn btn-primary w-fit sm:col-span-2">Save changes</button
							>
						</form>
					</details>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={a.id} />
						<button
							type="submit"
							class="btn btn-ghost text-xs"
							style="color:var(--color-down)"
							onclick={(e) => {
								if (!confirm(`Delete "${a.name}" and ALL its trades? This cannot be undone.`))
									e.preventDefault();
							}}
						>
							<Trash size={14} /> Delete
						</button>
					</form>
				</div>
			</div>
		{/each}
	</div>

	<form method="POST" action="?/create" use:enhance class="panel h-fit p-5">
		<h3 class="mb-3 font-semibold">New account</h3>
		<label class="label" for="name">Name</label>
		<input
			id="name"
			name="name"
			class="input mt-1 mb-3"
			placeholder="Main / TopStep 50K"
			required
		/>

		<label class="label" for="broker">Broker</label>
		<input id="broker" name="broker" class="input mt-1 mb-3" placeholder="Interactive Brokers" />

		<div class="mb-3 grid grid-cols-2 gap-3">
			<div>
				<label class="label" for="baseCurrency">Currency</label>
				<input id="baseCurrency" name="baseCurrency" class="input mt-1" value="USD" />
			</div>
			<div>
				<label class="label" for="startingBalance">Starting balance</label>
				<input
					id="startingBalance"
					name="startingBalance"
					class="input mt-1"
					type="text"
					inputmode="decimal"
					value="0"
				/>
			</div>
		</div>

		<div class="mb-3">
			<label class="label" for="timezone">Timezone</label>
			<select id="timezone" name="timezone" class="input mt-1">
				{#each data.timezones as tz (tz)}
					<option value={tz} selected={tz === 'UTC'}>{tz.replace('_', ' ')}</option>
				{/each}
			</select>
			<p class="mono mt-1 text-xs" style="color:var(--color-faint)">
				Days, weekdays & sessions are bucketed in this zone.
			</p>
		</div>

		<div class="label mb-1">Asset classes</div>
		<div class="mb-3 grid grid-cols-2 gap-1">
			{#each ASSET_CLASSES as ac (ac)}
				<label class="flex items-center gap-2 text-sm">
					<input type="checkbox" name="assetClasses" value={ac} checked={ac === 'stock'} />
					{ASSET_CLASS_LABELS[ac]}
				</label>
			{/each}
		</div>

		<label class="mb-3 flex items-center gap-2 text-sm">
			<input type="checkbox" name="isPropFirm" /> Prop-firm account
		</label>

		{#if form?.message}<p class="mb-2 text-sm" style="color:var(--color-down)">
				{form.message}
			</p>{/if}
		{#if form?.created}<p class="mb-2 text-sm" style="color:var(--color-up)">
				Account created ✓
			</p>{/if}
		<button type="submit" class="btn btn-primary w-full">Create account</button>
	</form>
</div>
