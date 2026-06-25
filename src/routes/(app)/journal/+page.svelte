<script lang="ts">
	import { enhance } from '$app/forms';
	import { formatDate } from '$lib/format';
	import { NotePencil, Trash } from 'phosphor-svelte';
	import { reveal } from '$lib/motion';

	let { data, form } = $props();
</script>

<svelte:head><title>Journal · TradeX</title></svelte:head>

<header class="mb-5">
	<h1 class="text-2xl font-bold">Journal</h1>
	<p class="mono mt-0.5 text-xs" style="color:var(--color-muted)">
		Daily reviews — the habit that compounds
	</p>
</header>

<div class="grid gap-3 lg:grid-cols-[22rem_1fr]">
	<form method="POST" action="?/create" use:enhance class="panel h-fit p-5">
		<h3 class="mb-3 flex items-center gap-2 font-semibold">
			<NotePencil size={18} style="color:var(--color-brand)" /> New entry
		</h3>
		<label class="label" for="date">Date</label>
		<input id="date" name="date" type="date" class="input mt-1 mb-3" value={data.today} />

		<label class="label" for="title">Title</label>
		<input id="title" name="title" class="input mt-1 mb-3" placeholder="Daily review" />

		<label class="label" for="body">Notes</label>
		<textarea
			id="body"
			name="body"
			rows="6"
			class="input mt-1"
			placeholder="What went well, what to fix, how I felt, rules I kept or broke…"></textarea>

		{#if form?.message}<p class="mt-2 text-sm" style="color:var(--color-down)">
				{form.message}
			</p>{/if}
		{#if form?.created}<p class="mt-2 text-sm" style="color:var(--color-up)">Saved ✓</p>{/if}
		<button type="submit" class="btn btn-primary mt-3 w-full">Save entry</button>
	</form>

	<div class="flex flex-col gap-3">
		{#if data.entries.length === 0}
			<div class="panel p-10 text-center" style="color:var(--color-muted)">
				No entries yet. Write your first review on the left.
			</div>
		{/if}
		{#each data.entries as e, i (e.id)}
			<div class="panel p-4" use:reveal={{ delay: 0.04 * i }}>
				<div class="flex items-start justify-between">
					<div>
						<div class="mono text-xs" style="color:var(--color-faint)">
							{formatDate(Date.parse(e.date))}
						</div>
						{#if e.title}<div class="font-semibold">{e.title}</div>{/if}
					</div>
					<form method="POST" action="?/delete" use:enhance>
						<input type="hidden" name="id" value={e.id} />
						<button
							class="text-xs"
							style="color:var(--color-muted)"
							title="Delete"
							aria-label="Delete entry"
						>
							<Trash size={16} />
						</button>
					</form>
				</div>
				<div class="mt-2 text-sm whitespace-pre-wrap">{e.body}</div>
			</div>
		{/each}
	</div>
</div>
