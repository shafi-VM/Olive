'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { ChatPanel } from '@/components/ChatPanel';
import { Sidebar } from '@/components/Sidebar';
import * as api from '@/lib/api';
import type { ConversationDetail, ConversationSummary, Message } from '@/lib/types';

const TEMP_USER = 'tmp-user';
const TEMP_ASSISTANT = 'tmp-assistant';

export default function ChatPage() {
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [providers, setProviders] = useState<string[]>(['mock']);
  const [provider, setProvider] = useState('mock');
  const [activeId, setActiveId] = useState<string | null>(null);
  const [detail, setDetail] = useState<ConversationDetail | null>(null);
  const [streaming, setStreaming] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const refreshList = useCallback(async () => {
    setConversations(await api.listConversations().catch(() => []));
  }, []);

  useEffect(() => {
    void refreshList();
    api
      .getProviders()
      .then((r) => {
        if (r.providers.length > 0) {
          setProviders(r.providers);
          setProvider(r.default);
        }
      })
      .catch(() => undefined);
  }, [refreshList]);

  const selectConversation = useCallback(async (id: string) => {
    setActiveId(id);
    setError(null);
    setDetail(await api.getConversation(id));
  }, []);

  async function newConversation() {
    const created = await api.createConversation({ provider });
    await refreshList();
    await selectConversation(created.id);
  }

  async function send(content: string) {
    if (!activeId || !detail) return;
    setError(null);

    const nowIso = new Date().toISOString();
    const base = detail.messages.length;
    const optimistic: Message[] = [
      { id: TEMP_USER, role: 'user', content, tokenCount: null, sequence: base, createdAt: nowIso },
      { id: TEMP_ASSISTANT, role: 'assistant', content: '', tokenCount: null, sequence: base + 1, createdAt: nowIso },
    ];
    setDetail((d) => (d ? { ...d, messages: [...d.messages, ...optimistic] } : d));
    setStreaming(true);

    const controller = new AbortController();
    abortRef.current = controller;

    try {
      for await (const event of api.streamMessage(activeId, content, controller.signal)) {
        if (event.type === 'token') {
          setDetail((d) =>
            d
              ? {
                  ...d,
                  messages: d.messages.map((m) =>
                    m.id === TEMP_ASSISTANT ? { ...m, content: m.content + event.value } : m,
                  ),
                }
              : d,
          );
        } else if (event.type === 'error') {
          setError(event.message);
        }
      }
    } catch (err) {
      if (!(err instanceof DOMException && err.name === 'AbortError')) {
        setError(err instanceof Error ? err.message : 'Stream failed');
      }
    } finally {
      setStreaming(false);
      abortRef.current = null;
      // Reload authoritative state (real ids, token counts, persisted content).
      const fresh = await api.getConversation(activeId).catch(() => null);
      if (fresh) setDetail(fresh);
      void refreshList();
    }
  }

  async function cancel() {
    abortRef.current?.abort();
    if (activeId) await api.cancelGeneration(activeId).catch(() => undefined);
  }

  async function archive() {
    if (!activeId) return;
    await api.updateConversation(activeId, { status: 'archived' });
    await refreshList();
    await selectConversation(activeId);
  }

  async function reactivate() {
    if (!activeId) return;
    await api.updateConversation(activeId, { status: 'active' });
    await refreshList();
    await selectConversation(activeId);
  }

  return (
    <div className="flex h-full">
      <Sidebar
        conversations={conversations}
        activeId={activeId}
        providers={providers}
        provider={provider}
        onProviderChange={setProvider}
        onSelect={selectConversation}
        onNew={newConversation}
      />
      <ChatPanel
        conversation={detail}
        streaming={streaming}
        error={error}
        onSend={send}
        onCancel={cancel}
        onArchive={archive}
        onReactivate={reactivate}
      />
    </div>
  );
}
