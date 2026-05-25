import type {
  ChatEvent,
  ConversationDetail,
  ConversationSummary,
  DashboardMetrics,
} from './types';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function json<T>(res: Response): Promise<T> {
  if (!res.ok) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Request failed (${res.status})`);
  }
  return res.json() as Promise<T>;
}

export function listConversations(): Promise<ConversationSummary[]> {
  return fetch(`${API_URL}/conversations`, { cache: 'no-store' }).then(json<ConversationSummary[]>);
}

export function getConversation(id: string): Promise<ConversationDetail> {
  return fetch(`${API_URL}/conversations/${id}`, { cache: 'no-store' }).then(
    json<ConversationDetail>,
  );
}

export function createConversation(body: {
  title?: string;
  provider?: string;
  model?: string;
}): Promise<ConversationSummary> {
  return fetch(`${API_URL}/conversations`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(json<ConversationSummary>);
}

export function updateConversation(
  id: string,
  body: { status?: string; title?: string },
): Promise<unknown> {
  return fetch(`${API_URL}/conversations/${id}`, {
    method: 'PATCH',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  }).then(json<unknown>);
}

export function cancelGeneration(id: string): Promise<{ cancelled: boolean }> {
  return fetch(`${API_URL}/conversations/${id}/cancel`, { method: 'POST' }).then(
    json<{ cancelled: boolean }>,
  );
}

export function getProviders(): Promise<{ providers: string[]; default: string; defaultModel: string }> {
  return fetch(`${API_URL}/providers`, { cache: 'no-store' }).then(
    json<{ providers: string[]; default: string; defaultModel: string }>,
  );
}

export function getMetrics(windowHours = 24): Promise<DashboardMetrics> {
  return fetch(`${API_URL}/dashboard/metrics?windowHours=${windowHours}`, {
    cache: 'no-store',
  }).then(json<DashboardMetrics>);
}

/**
 * Sends a user message and yields streamed chat events. Uses `fetch` (not
 * EventSource, which cannot POST) and parses the SSE frames from the body.
 */
export async function* streamMessage(
  conversationId: string,
  content: string,
  signal: AbortSignal,
): AsyncGenerator<ChatEvent> {
  const res = await fetch(`${API_URL}/conversations/${conversationId}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ content }),
    signal,
  });

  if (!res.ok || !res.body) {
    const body = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(body.error ?? `Stream failed (${res.status})`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by a blank line.
    let boundary = buffer.indexOf('\n\n');
    while (boundary !== -1) {
      const frame = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary + 2);
      const dataLine = frame.split('\n').find((l) => l.startsWith('data:'));
      if (dataLine) {
        yield JSON.parse(dataLine.slice(5).trim()) as ChatEvent;
      }
      boundary = buffer.indexOf('\n\n');
    }
  }
}
