/**
 * In-memory registry of in-flight generations, keyed by conversation id.
 *
 * Tradeoff: this is per-process. With multiple API replicas a cancel request
 * must reach the replica running the stream — solved in production with a
 * Redis pub/sub "cancel" channel. Documented in the README under scaling.
 */
const controllers = new Map<string, AbortController>();

/** Starts tracking a generation. Aborts any prior generation on the same conversation. */
export function registerGeneration(conversationId: string): AbortController {
  cancelGeneration(conversationId);
  const controller = new AbortController();
  controllers.set(conversationId, controller);
  return controller;
}

/** Stops tracking a generation once it has settled. */
export function releaseGeneration(conversationId: string, controller: AbortController): void {
  if (controllers.get(conversationId) === controller) {
    controllers.delete(conversationId);
  }
}

/** Aborts the in-flight generation for a conversation, if any. Returns whether one was found. */
export function cancelGeneration(conversationId: string): boolean {
  const controller = controllers.get(conversationId);
  if (!controller) return false;
  controller.abort();
  controllers.delete(conversationId);
  return true;
}

/** True if a generation is currently running for the conversation. */
export function isGenerating(conversationId: string): boolean {
  return controllers.has(conversationId);
}
