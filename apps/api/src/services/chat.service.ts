import { prisma } from '@olive/db';
import type { TokenUsage } from '@olive/llm-sdk';
import { logger } from '../config.js';
import { llmClient } from '../llm.js';
import { buildContext, getConversation } from './conversation.service.js';

/** Error carrying an HTTP status so routes can map failures cleanly. */
export class ChatError extends Error {
  constructor(
    readonly statusCode: number,
    message: string,
  ) {
    super(message);
    this.name = 'ChatError';
  }
}

export type ChatStreamEvent =
  | { type: 'meta'; userMessageId: string; assistantMessageId: string }
  | { type: 'token'; value: string }
  | { type: 'done'; status: 'success' | 'cancelled'; usage?: TokenUsage }
  | { type: 'error'; message: string };

export interface StreamReplyInput {
  conversationId: string;
  userContent: string;
  signal: AbortSignal;
}

/** Persists the final assistant text and bumps the conversation's updatedAt. */
async function finalize(
  conversationId: string,
  messageId: string,
  content: string,
  tokenCount: number | undefined,
): Promise<void> {
  await prisma.$transaction([
    prisma.message.update({
      where: { id: messageId },
      data: { content, tokenCount: tokenCount ?? null },
    }),
    prisma.conversation.update({
      where: { id: conversationId },
      data: { updatedAt: new Date() },
    }),
  ]);
}

/**
 * Orchestrates one assistant turn: persists the user message and an assistant
 * placeholder, streams the model reply (forwarding deltas as events), then
 * persists the final assistant content. Yields events the route renders as SSE.
 *
 * The assistant row is created up front so the asynchronously-ingested
 * inference log always has a valid `messageId` to reference.
 */
export async function* streamReply(input: StreamReplyInput): AsyncGenerator<ChatStreamEvent> {
  const conversation = await getConversation(input.conversationId);
  if (!conversation) throw new ChatError(404, 'Conversation not found');
  if (conversation.status !== 'active') {
    throw new ChatError(409, `Conversation is ${conversation.status} and cannot accept messages`);
  }

  const seqBase = conversation.messages.length;
  const [userMessage, assistantMessage] = await prisma.$transaction([
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'user',
        content: input.userContent,
        sequence: seqBase,
      },
    }),
    prisma.message.create({
      data: {
        conversationId: conversation.id,
        role: 'assistant',
        content: '',
        sequence: seqBase + 1,
      },
    }),
  ]);

  yield { type: 'meta', userMessageId: userMessage.id, assistantMessageId: assistantMessage.id };

  const context = buildContext([
    ...conversation.messages,
    { role: 'user', content: input.userContent },
  ]);

  const generation = llmClient.streamChat({
    provider: conversation.provider,
    model: conversation.model,
    messages: context,
    conversationId: conversation.id,
    messageId: assistantMessage.id,
    signal: input.signal,
  });

  let assistantText = '';
  try {
    let next = await generation.next();
    while (!next.done) {
      assistantText += next.value;
      yield { type: 'token', value: next.value };
      next = await generation.next();
    }
    const result = next.value;
    await finalize(
      conversation.id,
      assistantMessage.id,
      result.output || assistantText,
      result.usage?.completionTokens,
    );
    yield { type: 'done', status: 'success', usage: result.usage };
  } catch (err) {
    const cancelled =
      input.signal.aborted || (err instanceof Error && err.name === 'ProviderAbortError');

    if (cancelled && assistantText.length === 0) {
      // Cancelled before any output — drop the empty placeholder.
      await prisma.message.delete({ where: { id: assistantMessage.id } });
    } else {
      await finalize(conversation.id, assistantMessage.id, assistantText, undefined);
    }

    if (cancelled) {
      yield { type: 'done', status: 'cancelled' };
    } else {
      logger.error({ err, conversationId: conversation.id }, 'generation failed');
      yield {
        type: 'error',
        message: err instanceof Error ? err.message : 'Generation failed',
      };
    }
  }
}
