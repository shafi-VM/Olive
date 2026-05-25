'use client';

import Link from 'next/link';
import type { ConversationSummary } from '@/lib/types';
import { Badge, Button } from './ui';

interface SidebarProps {
  conversations: ConversationSummary[];
  activeId: string | null;
  providers: string[];
  provider: string;
  onProviderChange: (provider: string) => void;
  onSelect: (id: string) => void;
  onNew: () => void;
}

/** Conversation list — supports listing and resuming (click) a conversation. */
export function Sidebar({
  conversations,
  activeId,
  providers,
  provider,
  onProviderChange,
  onSelect,
  onNew,
}: SidebarProps) {
  return (
    <aside className="flex h-full w-72 flex-col border-r border-stone-200 bg-white">
      <div className="border-b border-stone-200 p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-lg font-bold text-olive-700">Olive</div>
            <div className="text-xs text-stone-400">Chat & observability</div>
          </div>
          <Button onClick={onNew}>+ New</Button>
        </div>
        <label className="mt-3 block text-xs text-stone-500">
          Provider for new chats
          <select
            value={provider}
            onChange={(e) => onProviderChange(e.target.value)}
            className="mt-1 w-full rounded-md border border-stone-300 px-2 py-1 text-sm"
          >
            {providers.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </label>
      </div>

      <nav className="flex-1 overflow-y-auto p-2">
        {conversations.length === 0 && (
          <p className="px-2 py-4 text-sm text-stone-400">No conversations yet.</p>
        )}
        {conversations.map((c) => (
          <button
            key={c.id}
            onClick={() => onSelect(c.id)}
            className={`mb-1 w-full rounded-lg p-2.5 text-left transition-colors ${
              c.id === activeId ? 'bg-olive-100' : 'hover:bg-stone-100'
            }`}
          >
            <div className="flex items-center justify-between gap-2">
              <span className="truncate text-sm font-medium text-stone-800">{c.title}</span>
              {c.status !== 'active' && <Badge tone={c.status}>{c.status}</Badge>}
            </div>
            <div className="mt-0.5 truncate text-xs text-stone-400">
              {c.provider} · {c.model} · {c.messageCount} msgs
            </div>
          </button>
        ))}
      </nav>

      <div className="border-t border-stone-200 p-3">
        <Link href="/dashboard">
          <Button variant="ghost" className="w-full">
            📊 Inference Dashboard
          </Button>
        </Link>
      </div>
    </aside>
  );
}
