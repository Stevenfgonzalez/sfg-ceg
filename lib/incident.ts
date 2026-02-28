import { UUID_REGEX, DEFAULT_INCIDENT_ID } from './constants';

// Resolve incident ID from user input, falling back to default.
// The default UUID allows submissions when no QR-scoped incident is available.
export function resolveIncidentId(providedId?: string | null): string {
  if (providedId && UUID_REGEX.test(providedId)) {
    return providedId;
  }
  return DEFAULT_INCIDENT_ID;
}
