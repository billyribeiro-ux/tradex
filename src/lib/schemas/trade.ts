import { z } from 'zod';
import { ASSET_CLASSES, DIRECTIONS } from '$lib/domain/enums';

/** Validation for the manual trade-entry form. Prices/qty are decimal strings. */
export const manualTradeSchema = z
	.object({
		symbol: z.string().trim().min(1, 'Symbol is required').max(24),
		assetClass: z.enum(ASSET_CLASSES),
		direction: z.enum(DIRECTIONS),
		qty: z.coerce.number().positive('Quantity must be > 0'),
		entryPrice: z.coerce.number().nonnegative(),
		entryAt: z.string().min(1, 'Entry time is required'),
		exitPrice: z.coerce.number().nonnegative().optional(),
		exitAt: z.string().optional(),
		fees: z.coerce.number().min(0).optional(),
		plannedStop: z.coerce.number().nonnegative().optional(),
		plannedTarget: z.coerce.number().nonnegative().optional(),
		confidence: z.coerce.number().int().min(1).max(10).optional(),
		notes: z.string().max(5000).optional()
	})
	// Exit price and exit time describe one event: require both or neither, so a
	// lone exitPrice isn't silently dropped (leaving the user with an open trade).
	.superRefine((v, ctx) => {
		const hasPrice = v.exitPrice != null;
		const hasAt = v.exitAt != null && v.exitAt.trim() !== '';
		if (hasPrice !== hasAt) {
			ctx.addIssue({
				code: 'custom',
				path: [hasPrice ? 'exitAt' : 'exitPrice'],
				message: 'Exit price and exit time must both be set (or both empty for an open position).'
			});
		}
	});

export type ManualTradeInput = z.infer<typeof manualTradeSchema>;
