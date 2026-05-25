export type ConversationStatus = 'active' | 'cancelled' | 'archived';
export type MessageRole = 'user' | 'assistant' | 'system';

export interface ConversationSummary {
  id: string;
  title: string;
  provider: string;
  model: string;
  status: ConversationStatus;
  messageCount: number;
  createdAt: string;
  updatedAt: string;
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  tokenCount: number | null;
  sequence: number;
  createdAt: string;
}

export interface ConversationDetail {
  id: string;
  title: string;
  provider: string;
  model: string;
  status: ConversationStatus;
  messages: Message[];
  generating: boolean;
}

export interface TokenUsage {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
  estimated: boolean;
}

export type ChatEvent =
  | { type: 'meta'; userMessageId: string; assistantMessageId: string }
  | { type: 'token'; value: string }
  | { type: 'done'; status: 'success' | 'cancelled'; usage?: TokenUsage }
  | { type: 'error'; message: string };

export interface DashboardMetrics {
  windowHours: number;
  summary: {
    totalRequests: number;
    errorCount: number;
    cancelledCount: number;
    errorRate: number;
    avgLatencyMs: number;
    p50LatencyMs: number;
    p95LatencyMs: number;
    totalTokens: number;
  };
  timeseries: { bucket: string; requests: number; errors: number; avgLatencyMs: number }[];
  byProvider: {
    provider: string;
    model: string;
    requests: number;
    avgLatencyMs: number;
    totalTokens: number;
    errorRate: number;
  }[];
  recent: {
    id: string;
    requestId: string;
    provider: string;
    model: string;
    status: string;
    latencyMs: number;
    totalTokens: number | null;
    errorType: string | null;
    inputPreview: string | null;
    createdAt: string;
  }[];
}
