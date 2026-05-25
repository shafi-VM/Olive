/**
 * Rough token estimate (~4 chars/token) used only when a provider does not
 * report usage. Real accounting always prefers provider-reported counts;
 * estimates are flagged via `TokenUsage.estimated` so the dashboard can
 * distinguish them.
 */
export function estimateTokens(text: string): number {
  return Math.max(1, Math.ceil(text.length / 4));
}
