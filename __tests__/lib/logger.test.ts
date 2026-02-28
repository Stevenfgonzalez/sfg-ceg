import { describe, it, expect, vi } from 'vitest';
import { log } from '@/lib/logger';

describe('log', () => {
  it('outputs valid JSON to console.log', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    log({ level: 'info', event: 'test_event', route: '/test' });

    expect(spy).toHaveBeenCalledOnce();
    const output = spy.mock.calls[0][0];
    const parsed = JSON.parse(output);
    expect(parsed.level).toBe('info');
    expect(parsed.event).toBe('test_event');
    expect(parsed.route).toBe('/test');
    expect(parsed.timestamp).toBeDefined();

    spy.mockRestore();
  });

  it('includes optional fields when provided', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    log({
      level: 'error',
      event: 'checkin_failed',
      route: '/api/public/checkin',
      incident_id: '550e8400-e29b-41d4-a716-446655440000',
      duration_ms: 42,
      error: 'Connection timeout',
      meta: { status: 'SAFE' },
    });

    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(parsed.incident_id).toBe('550e8400-e29b-41d4-a716-446655440000');
    expect(parsed.duration_ms).toBe(42);
    expect(parsed.error).toBe('Connection timeout');
    expect(parsed.meta.status).toBe('SAFE');

    spy.mockRestore();
  });

  it('adds ISO timestamp', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});

    log({ level: 'info', event: 'test', route: '/test' });

    const parsed = JSON.parse(spy.mock.calls[0][0]);
    expect(() => new Date(parsed.timestamp)).not.toThrow();
    expect(new Date(parsed.timestamp).toISOString()).toBe(parsed.timestamp);

    spy.mockRestore();
  });
});
