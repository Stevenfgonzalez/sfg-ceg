// NFC utility for Web NFC API (Chrome on Android only)
// Writes/reads NDEF URL records for FCC household access

// Web NFC type declarations
interface NDEFRecord {
  recordType: string;
  data?: string;
}

interface NDEFMessage {
  records: NDEFRecord[];
}

interface NDEFReadingEvent extends Event {
  message: NDEFMessage;
}

interface NDEFReader {
  write(message: { records: { recordType: string; data: string }[] }): Promise<void>;
  scan(): Promise<void>;
  addEventListener(type: 'reading', listener: (event: NDEFReadingEvent) => void): void;
  addEventListener(type: 'readingerror', listener: (event: Event) => void): void;
}

declare global {
  interface Window {
    NDEFReader?: new () => NDEFReader;
  }
}

/** Check if Web NFC is available (Chrome on Android only) */
export function isNfcSupported(): boolean {
  return typeof window !== 'undefined' && 'NDEFReader' in window;
}

/** Write an FCC URL to an NFC tag as an NDEF URL record */
export async function writeNfcTag(url: string): Promise<{ success: boolean; error?: string }> {
  if (!isNfcSupported()) {
    return { success: false, error: 'NFC not supported on this device' };
  }

  try {
    const ndef = new window.NDEFReader!();
    await ndef.write({
      records: [{ recordType: 'url', data: url }],
    });
    return { success: true };
  } catch (err) {
    if (err instanceof Error && err.name === 'NotAllowedError') {
      return { success: false, error: 'NFC permission denied. Allow NFC access in browser settings.' };
    }
    return { success: false, error: err instanceof Error ? err.message : 'NFC write failed' };
  }
}

/** Scan for NFC tags containing FCC URLs. Returns AbortController to stop scanning. */
export function startNfcScan(
  onRead: (url: string) => void,
  onError: (error: string) => void,
): AbortController | null {
  if (!isNfcSupported()) return null;

  const controller = new AbortController();

  (async () => {
    try {
      const ndef = new window.NDEFReader!();
      await ndef.scan();

      ndef.addEventListener('reading', (event: NDEFReadingEvent) => {
        for (const record of event.message.records) {
          if (record.recordType === 'url' && record.data) {
            // Check if it's an FCC URL
            const fccMatch = record.data.match(/\/fcc\/([a-f0-9-]+)/i);
            if (fccMatch) {
              onRead(record.data);
            }
          }
        }
      });

      ndef.addEventListener('readingerror', () => {
        onError('Failed to read NFC tag');
      });
    } catch (err) {
      if (!controller.signal.aborted) {
        if (err instanceof Error && err.name === 'NotAllowedError') {
          onError('NFC permission denied');
        } else {
          onError(err instanceof Error ? err.message : 'NFC scan failed');
        }
      }
    }
  })();

  return controller;
}
