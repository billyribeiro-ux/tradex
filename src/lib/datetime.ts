/**
 * Timezone-aware bucketing helpers. Trades store executedAt/closedAt as UTC
 * epoch ms, but a trader's "day" and "weekday" are in their account's local
 * timezone (a fill at 21:00 ET is 01:00 UTC the next day — same trading day to
 * them). These derive the local date/weekday/hour via Intl (DST-correct).
 *
 * Formatters are cached per timezone (constructing Intl.DateTimeFormat is the
 * expensive part) and an invalid timezone falls back to UTC.
 */
const WEEKDAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const cache = new Map<string, { date: Intl.DateTimeFormat; parts: Intl.DateTimeFormat }>();

function fmts(tz: string) {
	let f = cache.get(tz);
	if (!f) {
		try {
			f = {
				// en-CA renders YYYY-MM-DD
				date: new Intl.DateTimeFormat('en-CA', {
					timeZone: tz,
					year: 'numeric',
					month: '2-digit',
					day: '2-digit'
				}),
				parts: new Intl.DateTimeFormat('en-US', {
					timeZone: tz,
					weekday: 'short',
					hour: '2-digit',
					hourCycle: 'h23'
				})
			};
		} catch {
			return fmts('UTC');
		}
		cache.set(tz, f);
	}
	return f;
}

/** Local calendar date as YYYY-MM-DD in the given IANA timezone. */
export function tzDate(ms: number, tz = 'UTC'): string {
	return fmts(tz).date.format(ms);
}

/** Local weekday as 'Sunday'..'Saturday' (long form) in the given timezone. */
export function tzWeekday(ms: number, tz = 'UTC'): string {
	const wd = fmts(tz)
		.parts.formatToParts(ms)
		.find((p) => p.type === 'weekday')?.value; // 'Mon'..'Sun'
	const i = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(wd ?? 'Sun');
	return WEEKDAYS[i < 0 ? 0 : i]!;
}

/** Local hour 0-23 in the given timezone. */
export function tzHour(ms: number, tz = 'UTC'): number {
	const h = fmts(tz)
		.parts.formatToParts(ms)
		.find((p) => p.type === 'hour')?.value;
	return Number(h ?? 0) % 24;
}

const offsetCache = new Map<string, Intl.DateTimeFormat>();
function offsetFmt(tz: string): Intl.DateTimeFormat {
	let f = offsetCache.get(tz);
	if (!f) {
		try {
			f = new Intl.DateTimeFormat('en-US', {
				timeZone: tz,
				year: 'numeric',
				month: '2-digit',
				day: '2-digit',
				hour: '2-digit',
				minute: '2-digit',
				second: '2-digit',
				hourCycle: 'h23'
			});
		} catch {
			return offsetFmt('UTC');
		}
		offsetCache.set(tz, f);
	}
	return f;
}

/** The timezone's offset from UTC, in ms (local − UTC), at the given instant. */
function tzOffsetMs(ms: number, tz: string): number {
	const p = offsetFmt(tz).formatToParts(ms);
	const get = (t: string) => Number(p.find((x) => x.type === t)?.value ?? 0);
	const asIfUtc = Date.UTC(
		get('year'),
		get('month') - 1,
		get('day'),
		get('hour') % 24,
		get('minute'),
		get('second')
	);
	return asIfUtc - ms;
}

/**
 * Interpret a naive (timezone-less) wall-clock time as being in `tz` and return
 * the corresponding UTC epoch ms. e.g. 2026-06-24 14:30 in America/New_York
 * (EDT, −4) → 2026-06-24 18:30 UTC. Two correction passes handle DST boundaries.
 */
export function naiveToUtc(
	year: number,
	month0: number,
	day: number,
	hour: number,
	minute: number,
	second: number,
	tz = 'UTC'
): number {
	const guess = Date.UTC(year, month0, day, hour, minute, second);
	let utc = guess - tzOffsetMs(guess, tz);
	utc = guess - tzOffsetMs(utc, tz);
	return utc;
}
