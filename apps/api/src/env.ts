import { z } from 'zod';

export const envSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HOST: z.string().default('0.0.0.0'),
  PORT: z.coerce.number().int().default(4000),
  MONGODB_URI: z.string().min(1),
  BETTER_AUTH_SECRET: z.string().min(32, 'must be at least 32 characters'),
  BETTER_AUTH_URL: z.url(),
  WEB_ORIGIN: z.url().default('http://localhost:3000'),
  // Which proxies may set X-Forwarded-For. "loopback" trusts the Next.js dev proxy only.
  // In production, set this to your load balancer's address range.
  TRUST_PROXY: z.string().default('loopback'),
});

export type Env = z.infer<typeof envSchema>;

/** Validates process.env once at startup, so a missing variable fails fast and loudly. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = envSchema.safeParse(source);
  if (!result.success) {
    console.error(`Invalid environment variables:\n${z.prettifyError(result.error)}`);
    console.error('Copy apps/api/.env.example to apps/api/.env and fill it in.');
    process.exit(1);
  }
  return result.data;
}
