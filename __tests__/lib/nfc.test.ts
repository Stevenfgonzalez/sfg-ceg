import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// Helper to access globalThis.window as any — avoids TS strict casting issues in test mocks
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const g = globalThis as any;

let mockWrite: ReturnType<typeof vi.fn>;
let mockScan: ReturnType<typeof vi.fn>;
let readingListeners: ((event: { message: { records: { recordType: string; data?: string }[] } }) => void)[];
let errorListeners: ((event: Event) => void)[];

class MockNDEFReader {
  write = mockWrite;
  scan = mockScan;
  addEventListener(type: string, listener: (...args: unknown[]) => void) {
    if (type === 'reading') readingListeners.push(listener as typeof readingListeners[0]);
    if (type === 'readingerror') errorListeners.push(listener as typeof errorListeners[0]);
  }
}

beforeEach(() => {
  mockWrite = vi.fn().mockResolvedValue(undefined);
  mockScan = vi.fn().mockResolvedValue(undefined);
  readingListeners = [];
  errorListeners = [];
  if (typeof g.window !== 'undefined') {
    delete g.window.NDEFReader;
  }
});

afterEach(() => {
  if (typeof g.window !== 'undefined') {
    delete g.window.NDEFReader;
  }
});

function setupWindow() {
  if (typeof g.window === 'undefined') {
    g.window = {};
  }
}

function cleanupWindow() {
  if (g.window && Object.keys(g.window).length === 0) {
    delete g.window;
  }
}

describe('isNfcSupported', () => {
  it('returns false without NDEFReader', async () => {
    const { isNfcSupported } = await import('@/lib/nfc');
    expect(isNfcSupported()).toBe(false);
  });

  it('returns true with NDEFReader on window', async () => {
    setupWindow();
    g.window.NDEFReader = MockNDEFReader;
    const { isNfcSupported } = await import('@/lib/nfc');
    expect(isNfcSupported()).toBe(true);
    delete g.window.NDEFReader;
    cleanupWindow();
  });
});

describe('writeNfcTag', () => {
  it('returns error when NFC not supported', async () => {
    const { writeNfcTag } = await import('@/lib/nfc');
    const result = await writeNfcTag('https://ceg.sfg.ac/fcc/abc123');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/not supported/i);
  });

  it('writes URL record to tag', async () => {
    setupWindow();
    g.window.NDEFReader = MockNDEFReader;
    const { writeNfcTag } = await import('@/lib/nfc');
    const url = 'https://ceg.sfg.ac/fcc/abc123';
    const result = await writeNfcTag(url);
    expect(result.success).toBe(true);
    expect(mockWrite).toHaveBeenCalledWith({
      records: [{ recordType: 'url', data: url }],
    });
    delete g.window.NDEFReader;
    cleanupWindow();
  });

  it('handles NotAllowedError', async () => {
    setupWindow();
    const err = new Error('Permission denied');
    err.name = 'NotAllowedError';
    mockWrite = vi.fn().mockRejectedValue(err);
    g.window.NDEFReader = MockNDEFReader;
    const { writeNfcTag } = await import('@/lib/nfc');
    const result = await writeNfcTag('https://ceg.sfg.ac/fcc/abc123');
    expect(result.success).toBe(false);
    expect(result.error).toMatch(/permission denied/i);
    delete g.window.NDEFReader;
    cleanupWindow();
  });

  it('handles generic errors', async () => {
    setupWindow();
    mockWrite = vi.fn().mockRejectedValue(new Error('Hardware failure'));
    g.window.NDEFReader = MockNDEFReader;
    const { writeNfcTag } = await import('@/lib/nfc');
    const result = await writeNfcTag('https://ceg.sfg.ac/fcc/abc123');
    expect(result.success).toBe(false);
    expect(result.error).toBe('Hardware failure');
    delete g.window.NDEFReader;
    cleanupWindow();
  });
});

describe('startNfcScan', () => {
  it('returns null when NFC not supported', async () => {
    const { startNfcScan } = await import('@/lib/nfc');
    const onRead = vi.fn();
    const onError = vi.fn();
    const controller = startNfcScan(onRead, onError);
    expect(controller).toBeNull();
  });

  it('sets up scan and reading listener', async () => {
    setupWindow();
    g.window.NDEFReader = MockNDEFReader;
    const { startNfcScan } = await import('@/lib/nfc');
    const onRead = vi.fn();
    const onError = vi.fn();

    const controller = startNfcScan(onRead, onError);
    expect(controller).toBeInstanceOf(AbortController);

    await new Promise((r) => setTimeout(r, 10));

    expect(mockScan).toHaveBeenCalled();
    expect(readingListeners).toHaveLength(1);
    expect(errorListeners).toHaveLength(1);

    // Simulate reading an FCC URL
    readingListeners[0]({
      message: {
        records: [
          { recordType: 'url', data: 'https://ceg.sfg.ac/fcc/a1b2c3d4-e5f6-0000-0000-000000000001' },
        ],
      },
    });

    expect(onRead).toHaveBeenCalledWith('https://ceg.sfg.ac/fcc/a1b2c3d4-e5f6-0000-0000-000000000001');
    delete g.window.NDEFReader;
    cleanupWindow();
  });

  it('calls onError on readingerror', async () => {
    setupWindow();
    g.window.NDEFReader = MockNDEFReader;
    const { startNfcScan } = await import('@/lib/nfc');
    const onRead = vi.fn();
    const onError = vi.fn();

    startNfcScan(onRead, onError);
    await new Promise((r) => setTimeout(r, 10));

    errorListeners[0](new Event('readingerror'));
    expect(onError).toHaveBeenCalledWith('Failed to read NFC tag');
    delete g.window.NDEFReader;
    cleanupWindow();
  });
});
