import { fromScaled } from './money';

/** Format an epoch-ms timestamp as a UTC date (storage is UTC; tz support later). */
export function formatDate(ms: number | null): string {
	if (ms == null) return '—';
	return new Date(ms).toLocaleDateString('en-US', {
		year: 'numeric',
		month: 'short',
		day: 'numeric',
		timeZone: 'UTC'
	});
}

export function formatDateTime(ms: number | null): string {
	if (ms == null) return '—';
	return new Date(ms).toLocaleString('en-US', {
		month: 'short',
		day: 'numeric',
		year: 'numeric',
		hour: '2-digit',
		minute: '2-digit',
		timeZone: 'UTC'
	});
}

/** Human duration from ms, e.g. "2h 5m", "3d 1h", "45s". */
export function formatDuration(ms: number | null): string {
	if (ms == null || ms < 0) return '—';
	const s = Math.floor(ms / 1000);
	if (s < 60) return `${s}s`;
	const m = Math.floor(s / 60);
	if (m < 60) return `${m}m`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ${m % 60}m`;
	const d = Math.floor(h / 24);
	return `${d}d ${h % 24}h`;
}

/** Format a scaled ratio (0..1) as a percentage. */
export function formatPercent(scaledRatio: number, dp = 1): string {
	return `${(fromScaled(scaledRatio) * 100).toFixed(dp)}%`;
}

/** Datetime-local input value (UTC) from epoch ms. */
export function toDatetimeLocal(ms: number): string {
	return new Date(ms).toISOString().slice(0, 16);
}

/** Parse a datetime-local input value as UTC epoch ms. */
export function fromDatetimeLocal(value: string): number {
	return Date.parse(value.length === 16 ? `${value}:00Z` : value);
}
