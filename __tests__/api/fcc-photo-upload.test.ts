import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// ── Mocks ──

const mockServiceFrom = vi.fn();
const mockGetUser = vi.fn();
const mockStorageUpload = vi.fn();
const mockStorageRemove = vi.fn();
const mockStorageGetPublicUrl = vi.fn();

vi.mock('@/lib/supabase-auth-server', () => ({
  createAuthMiddlewareClient: () => ({
    auth: { getUser: mockGetUser },
  }),
}));

vi.mock('@/lib/supabase', () => ({
  createServiceClient: () => ({
    from: mockServiceFrom,
    storage: {
      from: () => ({
        upload: mockStorageUpload,
        remove: mockStorageRemove,
        getPublicUrl: mockStorageGetPublicUrl,
      }),
    },
  }),
}));

vi.mock('@/lib/logger', () => ({
  log: vi.fn(),
}));

import { POST, DELETE } from '@/app/api/fcc/members/[memberId]/photo/route';

// ── Helpers ──

const MOCK_USER = { id: 'user-1', email: 'test@sfg.ac' };

function mockChain(data: unknown, error: { message: string } | null = null) {
  return {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue({ data: data ? [data] : [], error }),
    single: vi.fn().mockResolvedValue({ data, error }),
    update: vi.fn().mockReturnThis(),
  };
}

function makeFormRequest(file: { size: number; type: string } | null): NextRequest {
  const formData = new FormData();
  if (file) {
    const blob = new Blob([new ArrayBuffer(file.size)], { type: file.type });
    formData.append('photo', blob, 'photo.jpg');
  }
  return new NextRequest('http://localhost/api/fcc/members/m-1/photo', {
    method: 'POST',
    body: formData,
  });
}

const routeParams = { params: { memberId: 'm-1' } };

beforeEach(() => {
  vi.clearAllMocks();
});

describe('POST /api/fcc/members/[memberId]/photo', () => {
  it('returns 401 when not authenticated', async () => {
    mockGetUser.mockResolvedValue({ data: { user: null } });
    const res = await POST(makeFormRequest({ size: 100, type: 'image/jpeg' }), routeParams);
    expect(res.status).toBe(401);
  });

  it('returns 404 when member not found', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const callIndex = { value: 0 };
    mockServiceFrom.mockImplementation(() => {
      callIndex.value++;
      // First call: getFccAuth owner check (succeed)
      if (callIndex.value === 1) return mockChain({ id: 'h-1' });
      // Second call: member lookup (not found)
      return mockChain(null, { message: 'not found' });
    });
    const res = await POST(makeFormRequest({ size: 100, type: 'image/jpeg' }), routeParams);
    expect(res.status).toBe(404);
  });

  it('rejects files over 2MB', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockServiceFrom.mockReturnValue(mockChain({ id: 'm-1', household_id: 'h-1', fcc_households: { owner_id: 'user-1' } }));
    const res = await POST(makeFormRequest({ size: 3 * 1024 * 1024, type: 'image/jpeg' }), routeParams);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/2MB/);
  });

  it('rejects non-image files', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockServiceFrom.mockReturnValue(mockChain({ id: 'm-1', household_id: 'h-1', fcc_households: { owner_id: 'user-1' } }));
    const res = await POST(makeFormRequest({ size: 100, type: 'application/pdf' }), routeParams);
    expect(res.status).toBe(400);
    const json = await res.json();
    expect(json.error).toMatch(/JPEG or PNG/);
  });

  it('uploads photo successfully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    // First call: member lookup; second call: update
    const memberChain = mockChain({ id: 'm-1', household_id: 'h-1', fcc_households: { owner_id: 'user-1' } });
    const updateChain = mockChain({ id: 'm-1' });
    mockServiceFrom.mockReturnValueOnce(memberChain).mockReturnValueOnce(updateChain);
    mockStorageUpload.mockResolvedValue({ error: null });
    mockStorageGetPublicUrl.mockReturnValue({ data: { publicUrl: 'https://storage.example.com/h-1/m-1.jpg' } });

    const res = await POST(makeFormRequest({ size: 100, type: 'image/jpeg' }), routeParams);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.photo_url).toContain('m-1.jpg');
  });

  it('returns 500 on storage upload failure', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    mockServiceFrom.mockReturnValue(mockChain({ id: 'm-1', household_id: 'h-1', fcc_households: { owner_id: 'user-1' } }));
    mockStorageUpload.mockResolvedValue({ error: { message: 'storage error' } });

    const res = await POST(makeFormRequest({ size: 100, type: 'image/jpeg' }), routeParams);
    expect(res.status).toBe(500);
  });
});

describe('DELETE /api/fcc/members/[memberId]/photo', () => {
  it('deletes photo successfully', async () => {
    mockGetUser.mockResolvedValue({ data: { user: MOCK_USER } });
    const memberChain = mockChain({ id: 'm-1', household_id: 'h-1', photo_url: 'https://storage.example.com/h-1/m-1.jpg', fcc_households: { owner_id: 'user-1' } });
    const updateChain = mockChain({ id: 'm-1' });
    mockServiceFrom.mockReturnValueOnce(memberChain).mockReturnValueOnce(updateChain);
    mockStorageRemove.mockResolvedValue({ error: null });

    const req = new NextRequest('http://localhost/api/fcc/members/m-1/photo', { method: 'DELETE' });
    const res = await DELETE(req, routeParams);
    expect(res.status).toBe(200);
    const json = await res.json();
    expect(json.success).toBe(true);
  });
});
