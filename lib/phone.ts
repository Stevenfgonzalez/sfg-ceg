import { createHash, createHmac } from 'crypto';

// Normalize phone to E.164-like format: +1XXXXXXXXXX
// Handles: (818) 555-1234, 818-555-1234, 8185551234, +18185551234
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');

  if (digits.length === 10) {
    return `+1${digits}`;
  }
  if (digits.length === 11 && digits.startsWith('1')) {
    return `+${digits}`;
  }

  // Already has country code or international
  return `+${digits}`;
}

// HMAC-SHA256 hash of normalized phone number with server-side secret.
// Without the secret, an attacker who gets a DB dump cannot build a rainbow table.
// Falls back to unsalted SHA-256 if secret is not set (legacy v1 behavior).
export function hashPhone(raw: string): string {
  const normalized = normalizePhone(raw);
  const secret = process.env.PHONE_HASH_SECRET;
  if (secret) {
    return createHmac('sha256', secret).update(normalized).digest('hex');
  }
  // Legacy fallback — unsalted SHA-256 (v1)
  return createHash('sha256').update(normalized).digest('hex');
}

// Hash version: 2 if PHONE_HASH_SECRET is set, 1 otherwise
export function getHashVersion(): number {
  return process.env.PHONE_HASH_SECRET ? 2 : 1;
}

// Legacy unsalted hash for reunification lookup backward compatibility
export function hashPhoneLegacy(raw: string): string {
  const normalized = normalizePhone(raw);
  return createHash('sha256').update(normalized).digest('hex');
}

// Extract last 4 digits for IC human verification
export function phoneLast4(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.slice(-4);
}
