import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase
const mockUpsert = vi.fn();
const mockFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: mockFrom,
  }),
}));

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
}));

import { POST } from '@/app/api/edge-sync/route';

const VALID_SECRET = 'test-edge-secret';

function makeRequest(body: unknown, secret?: string): NextRequest {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  if (secret) headers['x-edge-sync-secret'] = secret;
  return new NextRequest('http://localhost/api/edge-sync', {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });
}

function makeEvent(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    event_id: `evt-${Math.random().toString(36).slice(2, 8)}`,
    event_type: 'PHONE_CHECKIN',
    system: 'phone_pwa',
    fport: null,
    dev_eui: null,
    zone_id: 'zone-1',
    payload: { status: 'SAFE', party_size: 1 },
    source: 'phone',
    occurred_at: new Date().toISOString(),
    ...overrides,
  };
}

beforeEach(() => {
  vi.clearAllMocks();
  vi.stubEnv('EDGE_SYNC_SECRET', VALID_SECRET);

  // Default: successful upsert
  mockFrom.mockReturnValue({
    upsert: vi.fn().mockResolvedValue({ error: null }),
  });
});

describe('POST /api/edge-sync', () => {
  it('returns 401 with missing auth header', async () => {
    const res = await POST(makeRequest({ edge_node_id: 'pi-1', batch: [makeEvent()] }));
    expect(res.status).toBe(401);
  });

  it('returns 401 with wrong secret', async () => {
    const res = await POST(makeRequest({ edge_node_id: 'pi-1', batch: [makeEvent()] }, 'wrong-secret'));
    expect(res.status).toBe(401);
  });

  it('returns 400 for invalid body', async () => {
    const res = await POST(makeRequest({ foo: 'bar' }, VALID_SECRET));
    expect(res.status).toBe(400);
  });

  it('returns 400 for empty batch', async () => {
    const res = await POST(makeRequest({ edge_node_id: 'pi-1', batch: [] }, VALID_SECRET));
    expect(res.status).toBe(400);
  });

  it('returns 400 for batch > 200 events', async () => {
    const bigBatch = Array.from({ length: 201 }, (_, i) => makeEvent({ event_id: `evt-${i}` }));
    const res = await POST(makeRequest({ edge_node_id: 'pi-1', batch: bigBatch }, VALID_SECRET));
    expect(res.status).toBe(400);
  });

  it('accepts valid PHONE_CHECKIN event', async () => {
    const evt = makeEvent({ event_type: 'PHONE_CHECKIN' });
    const res = await POST(makeRequest({ edge_node_id: 'pi-1', batch: [evt] }, VALID_SECRET));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted_event_ids).toContain(evt.event_id);
    expect(json.rejected_event_ids).toHaveLength(0);
  });

  it('accepts valid MUSTER_BUTTON event', async () => {
    const evt = makeEvent({
      event_type: 'MUSTER_BUTTON',
      payload: { partySize: 3, status: 'AT_MUSTER', flags: { needsMedical: true, needsTransport: false } },
    });
    const res = await POST(makeRequest({ edge_node_id: 'pi-1', batch: [evt] }, VALID_SECRET));
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.accepted_event_ids).toContain(evt.event_id);
  });

  it('handles mixed accept/reject batch', async () => {
    const goodEvt = makeEvent({ event_id: 'good-1' });
    const badEvt = makeEvent({ event_id: 'bad-1' });

    let callCount = 0;
    mockFrom.mockImplementation(() => {
      callCount++;
      // Fail on the second event's upsert (3rd and 4th from calls are for checkins insert)
      if (callCount === 3 || callCount === 4) {
        return { upsert: vi.fn().mockRejectedValue(new Error('DB error')) };
      }
      return { upsert: vi.fn().mockResolvedValue({ error: null }) };
    });

    const res = await POST(makeRequest({ edge_node_id: 'pi-1', batch: [goodEvt, badEvt] }, VALID_SECRET));
    expect(res.status).toBe(200);
    const json = await res.json();
    // At minimum the first event should be accepted
    expect(json.accepted_event_ids.length + json.rejected_event_ids.length).toBe(2);
  });
});
