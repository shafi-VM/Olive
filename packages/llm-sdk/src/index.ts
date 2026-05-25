import type { Logger } from '@olive/shared';
import { OliveLLMClient } from './client.js';
import { createProviders } from './providers/index.js';
import { LogShipper } from './shipper.js';

export { OliveLLMClient } from './client.js';
export type { StreamChatOptions, StreamChatResult, LLMClientOptions } from './client.js';
export { LogShipper } from './shipper.js';
export type { ShipperOptions } from './shipper.js';
export { createProviders, GeminiProvider, OpenAIProvider, MockProvider } from './providers/index.js';
export type { ProviderConfig } from './providers/index.js';
export { buildInferenceLog } from './telemetry.js';
export * from './types.js';

export interface CreateLLMClientOptions {
  ingestionUrl: string;
  logger: Logger;
  geminiApiKey?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
}

/**
 * One-call wiring: builds the provider registry, the log shipper, and the
 * instrumented client. Returns the shipper too so the host app can flush it on
 * graceful shutdown.
 */
export function createLLMClient(opts: CreateLLMClientOptions): {
  client: OliveLLMClient;
  shipper: LogShipper;
} {
  const shipper = new LogShipper({ ingestionUrl: opts.ingestionUrl, logger: opts.logger });
  const providers = createProviders({
    geminiApiKey: opts.geminiApiKey,
    openaiApiKey: opts.openaiApiKey,
    openrouterApiKey: opts.openrouterApiKey,
  });
  const client = new OliveLLMClient({ providers, shipper, logger: opts.logger });
  return { client, shipper };
}
