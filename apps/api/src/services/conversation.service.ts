import { type Conversation, type Message, Prisma, prisma } from '@olive/db';
import type { ChatMessage, ConversationStatus } from '@olive/shared';
import { CONTEXT_WINDOW, SYSTEM_PROMPT, config } from '../config.js';

/** A conversation with its message-count, as returned to the sidebar. */
export type ConversationListItem = Prisma.ConversationGetPayload<{
  include: { _count: { select: { messages: true } } };
}>;

/** A conversation with its full ordered message history. */
export type ConversationWithMessages = Prisma.ConversationGetPayload<{
  include: { messages: true };
}>;

export interface CreateConversationInput {
  title?: string;
  provider?: string;
  model?: string;
}

/** Creates a conversation with provider/model defaults from configuration. */
export function createConversation(input: CreateConversationInput): Promise<Conversation> {
  return prisma.conversation.create({
    data: {
      title: input.title?.trim() || 'New conversation',
      provider: input.provider ?? config.DEFAULT_PROVIDER,
      model: input.model ?? config.DEFAULT_MODEL,
    },
  });
}

/** Lists conversations newest-first with a message count for the sidebar. */
export function listConversations(): Promise<ConversationListItem[]> {
  return prisma.conversation.findMany({
    orderBy: { updatedAt: 'desc' },
    include: { _count: { select: { messages: true } } },
  });
}

/** Loads a conversation with its full, ordered message history. */
export function getConversation(id: string): Promise<ConversationWithMessages | null> {
  return prisma.conversation.findUnique({
    where: { id },
    include: { messages: { orderBy: { sequence: 'asc' } } },
  });
}

/** Updates a conversation's status and/or title. */
export function updateConversation(
  id: string,
  data: { status?: ConversationStatus; title?: string },
): Promise<Conversation> {
  return prisma.conversation.update({ where: { id }, data });
}

/**
 * Builds the model context: a system prompt plus the last `CONTEXT_WINDOW`
 * messages. Keeping a bounded window caps prompt size, cost, and latency.
 */
export function buildContext(messages: Pick<Message, 'role' | 'content'>[]): ChatMessage[] {
  const recent = messages
    .filter((m) => m.content.trim().length > 0)
    .slice(-CONTEXT_WINDOW)
    .map((m) => ({ role: m.role, content: m.content }));
  return [{ role: 'system' as const, content: SYSTEM_PROMPT }, ...recent];
}
