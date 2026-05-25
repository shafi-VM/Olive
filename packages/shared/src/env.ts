import { existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { config as loadDotenv } from 'dotenv';
import { z } from 'zod';

/**
 * Loads the monorepo-root `.env` once. In Docker the environment is injected by
 * Compose, so a missing file is not an error — we just fall back to process.env.
 */
function bootstrapDotenv(): void {
  let dir = process.cwd();
  // Walk up until we find the workspace root (max 6 levels) so every app/package
  // resolves the same `.env` regardless of which directory it was started from.
  for (let i = 0; i < 6; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) {
      loadDotenv({ path: join(dir, '.env') });
      return;
    }
    const parent = dirname(dir);
    if (parent === dir) break;
    dir = parent;
  }
  loadDotenv();
}

bootstrapDotenv();

/**
 * Full environment schema. Every service validates against the same shape and
 * fails fast at boot with a readable error if a required variable is missing.
 */
const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url().default('redis://localhost:6379'),

  API_PORT: z.coerce.number().int().positive().default(4000),
  INGESTION_PORT: z.coerce.number().int().positive().default(4001),

  INGESTION_URL: z.string().url().default('http://localhost:4001'),
  NEXT_PUBLIC_API_URL: z.string().url().default('http://localhost:4000'),

  GEMINI_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OPENROUTER_API_KEY: z.string().optional(),

  DEFAULT_PROVIDER: z.enum(['gemini', 'openai', 'openrouter', 'mock']).default('gemini'),
  DEFAULT_MODEL: z.string().default('gemini-2.0-flash'),
});

export type Env = z.infer<typeof envSchema>;

let cached: Env | undefined;

/** Returns the validated, typed environment. Throws once, clearly, on bad config. */
export function getEnv(): Env {
  if (cached) return cached;
  const parsed = envSchema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  - ${i.path.join('.')}: ${i.message}`)
      .join('\n');
    throw new Error(`Invalid environment configuration:\n${issues}`);
  }
  cached = parsed.data;
  return cached;
}
