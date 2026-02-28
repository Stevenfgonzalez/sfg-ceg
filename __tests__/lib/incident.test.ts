import { describe, it, expect } from 'vitest';
import { resolveIncidentId } from '@/lib/incident';
import { DEFAULT_INCIDENT_ID } from '@/lib/constants';

describe('resolveIncidentId', () => {
  it('returns provided UUID when valid', () => {
    const id = '550e8400-e29b-41d4-a716-446655440000';
    expect(resolveIncidentId(id)).toBe(id);
  });

  it('returns default for null', () => {
    expect(resolveIncidentId(null)).toBe(DEFAULT_INCIDENT_ID);
  });

  it('returns default for undefined', () => {
    expect(resolveIncidentId(undefined)).toBe(DEFAULT_INCIDENT_ID);
  });

  it('returns default for empty string', () => {
    expect(resolveIncidentId('')).toBe(DEFAULT_INCIDENT_ID);
  });

  it('returns default for invalid UUID format', () => {
    expect(resolveIncidentId('not-a-uuid')).toBe(DEFAULT_INCIDENT_ID);
    expect(resolveIncidentId('12345')).toBe(DEFAULT_INCIDENT_ID);
  });

  it('handles case-insensitive UUIDs', () => {
    const upper = '550E8400-E29B-41D4-A716-446655440000';
    expect(resolveIncidentId(upper)).toBe(upper);
  });
});
