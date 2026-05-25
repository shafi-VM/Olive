import {
  createConversationSchema,
  sendMessageSchema,
  updateConversationSchema,
} from '@olive/shared';
import type { FastifyInstance, FastifyReply } from 'fastify';
import { z } from 'zod';
import { cancelGeneration, isGenerating, registerGeneration, releaseGeneration } from '../lib/cancellation.js';
import { ChatError, streamReply } from '../services/chat.service.js';
import {
  createConversation,
  getConversation,
  listConversations,
  updateConversation,
} from '../services/conversation.service.js';
import { llmClient } from '../llm.js';
import { config } from '../config.js';

const idParam = z.object({ id: z.string().uuid() });

/** Writes one Server-Sent Event frame to the raw socket. */
function sse(reply: FastifyReply, event: string, data: unknown): void {
  reply.raw.write(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`);
}

export async function conversationRoutes(app: FastifyInstance): Promise<void> {
  /** Available (configured) providers — used by the UI to populate a picker. */
  app.get('/providers', async () => {
    const providers = llmClient.listProviders();
    // Prefer the configured default; fall back to the first real provider, then mock.
    const defaultProvider = providers.includes(config.DEFAULT_PROVIDER)
      ? config.DEFAULT_PROVIDER
      : (providers.find((p) => p !== 'mock') ?? providers[0] ?? 'mock');
    return { providers, default: defaultProvider, defaultModel: config.DEFAULT_MODEL };
  });

  /** Create a conversation. */
  app.post('/conversations', async (req, reply) => {
    const body = createConversationSchema.parse(req.body);
    const conversation = await createConversation(body);
    return reply.status(201).send(conversation);
  });

  /** List conversations (newest first) for the sidebar. */
  app.get('/conversations', async () => {
    const conversations = await listConversations();
    return conversations.map((c) => ({
      id: c.id,
      title: c.title,
      provider: c.provider,
      model: c.model,
      status: c.status,
      messageCount: c._count.messages,
      createdAt: c.createdAt,
      updatedAt: c.updatedAt,
    }));
  });

  /** Load a conversation with full history — used to resume. */
  app.get('/conversations/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const conversation = await getConversation(id);
    if (!conversation) return reply.status(404).send({ error: 'Conversation not found' });
    return { ...conversation, generating: isGenerating(id) };
  });

  /** Update status (cancel/archive) or rename. */
  app.patch('/conversations/:id', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const body = updateConversationSchema.parse(req.body);
    const existing = await getConversation(id);
    if (!existing) return reply.status(404).send({ error: 'Conversation not found' });
    // Abort any in-flight generation when a conversation is cancelled/archived.
    if (body.status && body.status !== 'active') cancelGeneration(id);
    return updateConversation(id, body);
  });

  /** Cancel the in-flight generation for a conversation. */
  app.post('/conversations/:id/cancel', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const cancelled = cancelGeneration(id);
    return reply.send({ cancelled });
  });

  /**
   * Send a user message and stream the assistant reply as Server-Sent Events.
   * Conversation existence is validated before the response is hijacked so
   * client errors still return a clean JSON status code.
   */
  app.post('/conversations/:id/messages', async (req, reply) => {
    const { id } = idParam.parse(req.params);
    const { content } = sendMessageSchema.parse(req.body);

    const controller = registerGeneration(id);
    const events = streamReply({ conversationId: id, userContent: content, signal: controller.signal });

    let hijacked = false;
    let settled = false;
    try {
      for await (const event of events) {
        if (!hijacked) {
          reply.hijack();
          // Hijacking bypasses the CORS plugin's hooks, so the cross-origin
          // header must be set manually on the raw SSE response.
          reply.raw.writeHead(200, {
            'content-type': 'text/event-stream',
            'cache-control': 'no-cache',
            connection: 'keep-alive',
            'access-control-allow-origin': req.headers.origin ?? '*',
          });
          hijacked = true;
          // Abort generation if the client disconnects mid-stream. Attached
          // after hijack so it observes a real client close, not body-end.
          reply.raw.on('close', () => {
            if (!settled) controller.abort();
          });
        }
        sse(reply, event.type, event);
      }
      settled = true;
      reply.raw.end();
    } catch (err) {
      if (err instanceof ChatError && !hijacked) {
        return reply.status(err.statusCode).send({ error: err.message });
      }
      if (!hijacked) {
        req.log.error({ err }, 'unexpected error before stream start');
        return reply.status(500).send({ error: 'Internal error' });
      }
      // Stream already open — surface the failure as an SSE error frame.
      settled = true;
      sse(reply, 'error', { type: 'error', message: 'Stream failed' });
      reply.raw.end();
    } finally {
      releaseGeneration(id, controller);
    }
    return reply;
  });
}
