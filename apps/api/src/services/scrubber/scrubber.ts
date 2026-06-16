const SECRET_PATTERN =
  /(?:api[_-]?key|token|secret|password|passwd|pwd|private[_-]?key)\s*[:=]\s*['"]?[a-zA-Z0-9_\-+/=]{8,}/gi;

const HOSTNAME_PATTERN = /\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/g;

const IPV4_PATTERN = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;

const PROPRIETARY_PATTERN = /\b(?:internal only|confidential|proprietary|do not share)\b/gi;

function redactSecrets(text: string): string {
  return text.replace(SECRET_PATTERN, '[REDACTED_SECRET]');
}

function redactHostnames(text: string): string {
  return text.replace(HOSTNAME_PATTERN, '[HOSTNAME]').replace(IPV4_PATTERN, '[IP]');
}

function redactProprietary(text: string): string {
  return text.replace(PROPRIETARY_PATTERN, '[REDACTED]');
}

function scrubString(text: string): string {
  return redactProprietary(redactHostnames(redactSecrets(text)));
}

export function scrubValue(value: unknown): unknown {
  if (typeof value === 'string') return scrubString(value);
  if (Array.isArray(value)) return value.map(scrubValue);
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([k, v]) => [k, scrubValue(v)]));
  }
  return value;
}

export function scrubForTier<T>(value: T, tier: number): T {
  // Scrub identifiers only before T2 (cloud/ephemeral) dispatch.
  if (tier !== 2) return value;
  return scrubValue(value) as T;
}
