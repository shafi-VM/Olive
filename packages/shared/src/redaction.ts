/**
 * Lightweight, dependency-free PII redaction.
 *
 * Applied by the ingestion worker before previews are persisted, so raw PII
 * never lands in the analytics database. Regex-based by design: fast, explicit,
 * and good enough for previews. A production system would layer an NER model
 * for names/addresses — noted as a tradeoff in the README.
 */

interface RedactionRule {
  readonly label: string;
  readonly pattern: RegExp;
}

const RULES: readonly RedactionRule[] = [
  { label: 'EMAIL', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
  {
    label: 'CREDIT_CARD',
    pattern: /\b(?:\d[ -]*?){13,16}\b/g,
  },
  { label: 'SSN', pattern: /\b\d{3}-\d{2}-\d{4}\b/g },
  {
    label: 'PHONE',
    pattern: /\b(?:\+?\d{1,3}[-.\s]?)?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4}\b/g,
  },
  { label: 'IP', pattern: /\b(?:\d{1,3}\.){3}\d{1,3}\b/g },
];

export interface RedactionResult {
  readonly text: string;
  /** Count of matches per rule label, e.g. `{ EMAIL: 2 }`. */
  readonly counts: Record<string, number>;
  readonly redacted: boolean;
}

/** Replaces detected PII with `[REDACTED_<TYPE>]` and reports what was found. */
export function redactPII(input: string | null | undefined): RedactionResult {
  if (!input) return { text: '', counts: {}, redacted: false };

  const counts: Record<string, number> = {};
  let text = input;

  for (const rule of RULES) {
    text = text.replace(rule.pattern, () => {
      counts[rule.label] = (counts[rule.label] ?? 0) + 1;
      return `[REDACTED_${rule.label}]`;
    });
  }

  return { text, counts, redacted: Object.keys(counts).length > 0 };
}

/**
 * Truncates text to at most `max` characters (default 500), ellipsis included —
 * the returned string is guaranteed never to exceed `max`.
 */
export function truncate(input: string | null | undefined, max = 500): string {
  if (!input) return '';
  if (input.length <= max) return input;
  return `${input.slice(0, Math.max(0, max - 1))}…`;
}
