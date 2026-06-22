const SECRET_PATTERN =
  /(?:api[_-]?key|token|secret|password|passwd|pwd|private[_-]?key)\s*[:=]\s*['"]?[a-zA-Z0-9_\-+/=]{8,}/gi;

const HOSTNAME_PATTERN = /\b(?:[a-zA-Z0-9-]+\.)+[a-zA-Z]{2,}\b/g;

const IPV4_PATTERN = /\b\d{1,3}(?:\.\d{1,3}){3}\b/g;

const PROPRIETARY_PATTERN = /\b(?:internal only|confidential|proprietary|do not share)\b/gi;

const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g;

const PHONE_PATTERN = /\b(?:\+?1[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g;

const SSN_PATTERN = /\b\d{3}[-.\s]?\d{2}[-.\s]?\d{4}\b/g;

const CREDIT_CARD_PATTERN = /\b(?:\d[\s-]*){13,19}\b/g;

const NATIONAL_ID_PATTERN = /\b\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}[-.\s]?\d{2,4}\b/g;

function redactSecrets(text: string): string {
  return text.replace(SECRET_PATTERN, '[REDACTED_SECRET]');
}

function redactHostnames(text: string): string {
  return text.replace(HOSTNAME_PATTERN, '[HOSTNAME]').replace(IPV4_PATTERN, '[IP]');
}

function redactProprietary(text: string): string {
  return text.replace(PROPRIETARY_PATTERN, '[REDACTED]');
}

function redactEmails(text: string): string {
  return text.replace(EMAIL_PATTERN, '[EMAIL]');
}

function redactPhoneNumbers(text: string): string {
  return text.replace(PHONE_PATTERN, '[PHONE]');
}

function redactSsn(text: string): string {
  return text.replace(SSN_PATTERN, '[SSN]');
}

function redactCreditCards(text: string): string {
  return text.replace(CREDIT_CARD_PATTERN, '[CREDIT_CARD]');
}

function redactNationalIds(text: string): string {
  return text.replace(NATIONAL_ID_PATTERN, '[ID]');
}

function scrubString(text: string): string {
  // Secrets first so their values are not mangled by ID/card/hostname patterns.
  const withoutSecrets = redactSecrets(text);
  return redactProprietary(
    redactHostnames(
      redactNationalIds(
        redactCreditCards(redactSsn(redactPhoneNumbers(redactEmails(withoutSecrets))))
      )
    )
  );
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
  // Scrub PII, secrets, and identifiers before any non-local (cloud/ephemeral) dispatch.
  if (tier === 0) return value;
  return scrubValue(value) as T;
}
