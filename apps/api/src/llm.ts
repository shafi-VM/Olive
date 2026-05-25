import { createLLMClient } from '@olive/llm-sdk';
import { config, logger } from './config.js';

/**
 * Process-wide instrumented LLM client. The shipper is exported so the server
 * can flush pending inference logs during graceful shutdown.
 */
export const { client: llmClient, shipper: logShipper } = createLLMClient({
  ingestionUrl: config.INGESTION_URL,
  logger: logger.child({ module: 'llm-sdk' }),
  geminiApiKey: config.GEMINI_API_KEY,
  openaiApiKey: config.OPENAI_API_KEY,
  openrouterApiKey: config.OPENROUTER_API_KEY,
});
