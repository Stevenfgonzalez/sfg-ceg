import { describe, it, expect } from 'vitest';
import { _formatSmsMessage, type AlertPayload } from '@/lib/alerting';

describe('_formatSmsMessage', () => {
  it('formats a Tier 1 help request with full data', () => {
    const payload: AlertPayload = {
      type: 'help_request',
      triage_tier: 1,
      complaint_code: 'CHEST_PAIN',
      complaint_label: 'Chest pain or pressure',
      caller_name: 'John',
      party_size: 2,
      assembly_point: 'North Lot',
      lat: 34.05,
      lon: -118.24,
    };

    const msg = _formatSmsMessage(payload);

    expect(msg).toContain('[CEG ALERT]');
    expect(msg).toContain('Tier 1 Help: Chest pain or pressure');
    expect(msg).toContain('Caller: John');
    expect(msg).toContain('Party: 2');
    expect(msg).toContain('AP: North Lot');
    expect(msg).toContain('GPS: https://maps.google.com/?q=34.05,-118.24');
  });

  it('formats an IMMEDIATE checkin alert', () => {
    const payload: AlertPayload = {
      type: 'checkin',
      priority: 'IMMEDIATE',
      full_name: 'Jane Doe',
      party_size: 3,
      assembly_point: 'Main Gate',
    };

    const msg = _formatSmsMessage(payload);

    expect(msg).toContain('[CEG ALERT]');
    expect(msg).toContain('IMMEDIATE Check-in: IMMEDIATE');
    expect(msg).toContain('Caller: Jane Doe');
    expect(msg).toContain('Party: 3');
    expect(msg).toContain('AP: Main Gate');
    expect(msg).not.toContain('GPS:');
  });

  it('uses defaults for missing fields', () => {
    const payload: AlertPayload = {
      type: 'help_request',
      triage_tier: 1,
    };

    const msg = _formatSmsMessage(payload);

    expect(msg).toContain('Caller: Unknown');
    expect(msg).toContain('Party: 1');
    expect(msg).toContain('AP: Not specified');
    expect(msg).toContain('Tier 1 Help: Unknown');
  });

  it('includes dispatch note when provided', () => {
    const payload: AlertPayload = {
      type: 'help_request',
      triage_tier: 1,
      complaint_label: 'Severe bleeding',
      dispatch_note: 'Multiple casualties reported',
    };

    const msg = _formatSmsMessage(payload);

    expect(msg).toContain('Note: Multiple casualties reported');
  });

  it('omits dispatch note when absent', () => {
    const payload: AlertPayload = {
      type: 'help_request',
      triage_tier: 2,
      complaint_label: 'Burns',
    };

    const msg = _formatSmsMessage(payload);

    expect(msg).not.toContain('Note:');
  });

  it('uses caller_name over full_name when both present', () => {
    const payload: AlertPayload = {
      type: 'help_request',
      triage_tier: 1,
      caller_name: 'Alice',
      full_name: 'Bob',
    };

    const msg = _formatSmsMessage(payload);

    expect(msg).toContain('Caller: Alice');
    expect(msg).not.toContain('Bob');
  });

  it('falls back to full_name when caller_name absent', () => {
    const payload: AlertPayload = {
      type: 'checkin',
      full_name: 'Bob',
    };

    const msg = _formatSmsMessage(payload);

    expect(msg).toContain('Caller: Bob');
  });

  it('omits GPS line when only lat or only lon present', () => {
    const payload: AlertPayload = {
      type: 'help_request',
      triage_tier: 1,
      lat: 34.05,
    };

    const msg = _formatSmsMessage(payload);
    expect(msg).not.toContain('GPS:');
  });

  it('uses complaint_code when complaint_label is missing', () => {
    const payload: AlertPayload = {
      type: 'help_request',
      triage_tier: 1,
      complaint_code: 'CHEST_PAIN',
    };

    const msg = _formatSmsMessage(payload);
    expect(msg).toContain('Tier 1 Help: CHEST_PAIN');
  });
});
