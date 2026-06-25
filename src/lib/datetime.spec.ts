import { describe, it, expect } from 'vitest';
import { tzDate, tzWeekday, tzHour } from './datetime';

// 2026-06-24 02:00 UTC === 2026-06-23 22:00 in America/New_York (EDT, -4)
const ms = Date.UTC(2026, 5, 24, 2, 0, 0);

describe('timezone bucketing', () => {
	it('buckets by UTC day/hour when tz is UTC', () => {
		expect(tzDate(ms, 'UTC')).toBe('2026-06-24');
		expect(tzHour(ms, 'UTC')).toBe(2);
	});

	it('shifts the local day/hour for a non-UTC account timezone', () => {
		expect(tzDate(ms, 'America/New_York')).toBe('2026-06-23');
		expect(tzHour(ms, 'America/New_York')).toBe(22);
		// the local weekday is the day before the UTC weekday here
		expect(tzWeekday(ms, 'America/New_York')).not.toBe(tzWeekday(ms, 'UTC'));
	});

	it('returns long weekday names', () => {
		expect([
			'Sunday',
			'Monday',
			'Tuesday',
			'Wednesday',
			'Thursday',
			'Friday',
			'Saturday'
		]).toContain(tzWeekday(ms, 'UTC'));
	});

	it('falls back to UTC for an invalid timezone', () => {
		expect(tzDate(ms, 'Not/AZone')).toBe(tzDate(ms, 'UTC'));
		expect(tzHour(ms, 'Not/AZone')).toBe(tzHour(ms, 'UTC'));
	});
});
