import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'node:crypto';
import { env } from '$env/dynamic/private';

/**
 * AES-256-GCM encryption for secrets at rest (the user's BYO AI API key).
 * The key is derived from APP_ENCRYPTION_KEY (preferred) or BETTER_AUTH_SECRET.
 * Format: base64(iv).base64(authTag).base64(ciphertext)
 */
function key(): Buffer {
	const secret = env.APP_ENCRYPTION_KEY || env.BETTER_AUTH_SECRET;
	if (!secret) throw new Error('No encryption secret configured');
	return createHash('sha256').update(secret).digest();
}

export function encryptSecret(plain: string): string {
	const iv = randomBytes(12);
	const cipher = createCipheriv('aes-256-gcm', key(), iv);
	const enc = Buffer.concat([cipher.update(plain, 'utf8'), cipher.final()]);
	const tag = cipher.getAuthTag();
	return [iv.toString('base64'), tag.toString('base64'), enc.toString('base64')].join('.');
}

export function decryptSecret(payload: string): string | null {
	try {
		const [ivB, tagB, encB] = payload.split('.');
		if (!ivB || !tagB || !encB) return null;
		const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB, 'base64'));
		decipher.setAuthTag(Buffer.from(tagB, 'base64'));
		const dec = Buffer.concat([decipher.update(Buffer.from(encB, 'base64')), decipher.final()]);
		return dec.toString('utf8');
	} catch {
		return null;
	}
}
