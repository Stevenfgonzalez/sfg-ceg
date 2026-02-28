// Feature flags — env-based for progressive rollout
// Set to 'false' to disable; any other value (or unset) = enabled

export const flags = {
  offlineQueue: process.env.NEXT_PUBLIC_FF_OFFLINE_QUEUE !== 'false',
  saltedHashing: process.env.FF_SALTED_HASHING !== 'false',
  structuredLogging: process.env.FF_STRUCTURED_LOGGING !== 'false',
} as const;
