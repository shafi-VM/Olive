'use client';

import { useEffect, useRef, useState } from 'react';
import type { ConversationDetail } from '@/lib/types';
import { Badge, Button } from './ui';

interface ChatPanelProps {
  conversation: ConversationDetail | null;
  streaming: boolean;
  error: string | null;
  onSend: (content: string) => void;
  onCancel: () => void;
  onArchive: () => void;
  onReactivate: () => void;
}

/** The chat surface: message history, composer, and streaming/cancel controls. */
export function ChatPanel({
  conversation,
  streaming,
  error,
  onSend,
  onCancel,
  onArchive,
  onReactivate,
}: ChatPanelProps) {
  const [draft, setDraft] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
  }, [conversation?.messages, streaming]);

  if (!conversation) {
    return (
      <div className="flex flex-1 items-center justify-center text-stone-400">
        Select or start a conversation.
      </div>
    );
  }

  const archived = conversation.status !== 'active';

  function submit() {
    const text = draft.trim();
    if (!text || streaming) return;
    onSend(text);
    setDraft('');
  }

  return (
    <div className="flex flex-1 flex-col">
      <header className="flex items-center justify-between border-b border-stone-200 bg-white px-6 py-3">
        <div>
          <div className="flex items-center gap-2 font-semibold text-stone-800">
            {conversation.title}
            {archived && <Badge tone={conversation.status}>{conversation.status}</Badge>}
          </div>
          <div className="text-xs text-stone-400">
            {conversation.provider} · {conversation.model}
          </div>
        </div>
        {archived ? (
          <Button variant="ghost" onClick={onReactivate}>
            Reactivate
          </Button>
        ) : (
          <Button variant="ghost" onClick={onArchive}>
            Archive
          </Button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 space-y-4 overflow-y-auto p-6">
        {conversation.messages
          .filter((m) => m.role !== 'system')
          .map((m) => (
            <div
              key={m.id}
              className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[75%] whitespace-pre-wrap rounded-2xl px-4 py-2.5 text-sm ${
                  m.role === 'user'
                    ? 'bg-olive-600 text-white'
                    : 'border border-stone-200 bg-white text-stone-800'
                }`}
              >
                {m.content || (streaming ? <span className="text-stone-400">…</span> : '')}
                {m.tokenCount != null && (
                  <div className="mt-1 text-[10px] opacity-60">{m.tokenCount} tokens</div>
                )}
              </div>
            </div>
          ))}
        {error && (
          <div className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</div>
        )}
      </div>

      <div className="border-t border-stone-200 bg-white p-4">
        {archived ? (
          <p className="text-center text-sm text-stone-400">
            This conversation is {conversation.status} and is read-only.
          </p>
        ) : (
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  submit();
                }
              }}
              rows={2}
              placeholder="Send a message…  (Enter to send, Shift+Enter for newline)"
              className="flex-1 resize-none rounded-lg border border-stone-300 px-3 py-2 text-sm focus:border-olive-400 focus:outline-none"
            />
            {streaming ? (
              <Button variant="danger" onClick={onCancel}>
                Stop
              </Button>
            ) : (
              <Button onClick={submit} disabled={!draft.trim()}>
                Send
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
