import { createHash } from 'crypto';

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

// SHA-256 hash of normalized phone number
export function hashPhone(raw: string): string {
  const normalized = normalizePhone(raw);
  return createHash('sha256').update(normalized).digest('hex');
}

// Extract last 4 digits for IC human verification
export function phoneLast4(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  return digits.slice(-4);
}
