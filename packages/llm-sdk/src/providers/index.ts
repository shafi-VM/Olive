import type { LLMProvider } from '../types.js';
import { GeminiProvider } from './gemini.js';
import { MockProvider } from './mock.js';
import { OpenAIProvider } from './openai.js';

export { GeminiProvider, MockProvider, OpenAIProvider };

export interface ProviderConfig {
  geminiApiKey?: string;
  openaiApiKey?: string;
  openrouterApiKey?: string;
}

/**
 * Builds the provider registry from available credentials. `mock` is always
 * present so the system runs with zero keys; real providers are added only
 * when their key is configured.
 */
export function createProviders(cfg: ProviderConfig): Record<string, LLMProvider> {
  const providers: Record<string, LLMProvider> = { mock: new MockProvider() };
  if (cfg.geminiApiKey) providers.gemini = new GeminiProvider(cfg.geminiApiKey);
  if (cfg.openaiApiKey) providers.openai = new OpenAIProvider(cfg.openaiApiKey);
  if (cfg.openrouterApiKey) {
    // OpenRouter is OpenAI-compatible — same provider class, different base URL.
    providers.openrouter = new OpenAIProvider(cfg.openrouterApiKey, {
      name: 'openrouter',
      baseURL: 'https://openrouter.ai/api/v1',
      defaultHeaders: { 'HTTP-Referer': 'https://olive.local', 'X-Title': 'Olive' },
    });
  }
  return providers;
}
