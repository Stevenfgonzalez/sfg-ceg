// Fire-and-forget alerting for Tier 1 / IMMEDIATE events
// SMS via Twilio REST API + webhook with HMAC signature
// No-op if env vars not configured — never blocks the caller

import { log } from '@/lib/logger';
import { createHmac } from 'crypto';

export interface AlertPayload {
  type: 'help_request' | 'checkin';
  triage_tier?: number;
  complaint_code?: string;
  complaint_label?: string;
  caller_name?: string;
  full_name?: string;
  party_size?: number;
  assembly_point?: string | null;
  lat?: number;
  lon?: number;
  priority?: string;
  dispatch_note?: string;
}

/** Format SMS body from alert payload — exported for testing */
export function _formatSmsMessage(p: AlertPayload): string {
  const name = p.caller_name || p.full_name || 'Unknown';
  const label = p.complaint_label || p.complaint_code || p.priority || 'Unknown';
  const party = p.party_size ?? 1;
  const ap = p.assembly_point || 'Not specified';

  const lines = [
    '[CEG ALERT]',
    p.type === 'help_request'
      ? `Tier ${p.triage_tier ?? '?'} Help: ${label}`
      : `IMMEDIATE Check-in: ${label}`,
    `Caller: ${name}`,
    `Party: ${party}`,
    `AP: ${ap}`,
  ];

  if (typeof p.lat === 'number' && typeof p.lon === 'number') {
    lines.push(`GPS: https://maps.google.com/?q=${p.lat},${p.lon}`);
  }

  if (p.dispatch_note) {
    lines.push(`Note: ${p.dispatch_note}`);
  }

  return lines.join('\n');
}

async function sendSms(message: string): Promise<void> {
  const sid = process.env.TWILIO_ACCOUNT_SID;
  const token = process.env.TWILIO_AUTH_TOKEN;
  const from = process.env.TWILIO_FROM_NUMBER;
  const to = process.env.ALERT_PHONE;

  if (!sid || !token || !from || !to) return;

  const url = `https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`;
  const params = new URLSearchParams({ To: to, From: from, Body: message });

  const res = await fetch(url, {
    method: 'POST',
    headers: {
      Authorization: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64'),
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: params.toString(),
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`Twilio ${res.status}: ${text.slice(0, 200)}`);
  }
}

async function sendWebhook(payload: AlertPayload): Promise<void> {
  const url = process.env.ALERT_WEBHOOK_URL;
  const secret = process.env.ALERT_WEBHOOK_SECRET;

  if (!url) return;

  const body = JSON.stringify(payload);
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };

  if (secret) {
    const sig = createHmac('sha256', secret).update(body).digest('hex');
    headers['X-CEG-Signature'] = `sha256=${sig}`;
  }

  const res = await fetch(url, {
    method: 'POST',
    headers,
    body,
    signal: AbortSignal.timeout(10_000),
  });

  if (!res.ok) {
    throw new Error(`Webhook ${res.status}`);
  }
}

/**
 * Fire-and-forget: kicks off SMS + webhook in parallel.
 * All errors are caught and logged at warn — never throws.
 */
export function fireAlert(payload: AlertPayload): void {
  const message = _formatSmsMessage(payload);

  // Run in background — intentionally not awaited
  Promise.allSettled([
    sendSms(message),
    sendWebhook(payload),
  ]).then((results) => {
    for (const r of results) {
      if (r.status === 'rejected') {
        log({
          level: 'warn',
          event: 'alert_send_failed',
          route: '/lib/alerting',
          error: r.reason instanceof Error ? r.reason.message : String(r.reason),
        });
      }
    }
  });
}
