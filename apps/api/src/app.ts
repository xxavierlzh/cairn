import helmet from '@fastify/helmet';
import rateLimit from '@fastify/rate-limit';
import Fastify, { type FastifyError } from 'fastify';
import type { Db } from 'mongodb';
import { ZodError } from 'zod';
import type { Auth } from './auth/auth';
import { authRoutes } from './auth/routes';
import type { Env } from './env';
import { noteRoutes } from './notes/routes';

export interface AppDeps {
  env: Env;
  db: Db;
  auth: Auth;
}

/** Builds the Fastify app without starting it, so tests can call `app.inject()`. */
export async function buildApp({ env, db, auth }: AppDeps) {
  const app = Fastify({
    logger: env.NODE_ENV === 'test' ? false : { level: 'info' },
    trustProxy: env.TRUST_PROXY,
    // Notes can be up to 200k characters; leave headroom for multi-byte text and JSON escaping.
    bodyLimit: 2 * 1024 * 1024,
  });

  app.setErrorHandler((error: FastifyError, request, reply) => {
    if (error instanceof ZodError) {
      return reply.status(400).send({
        error: 'ValidationError',
        message: error.issues[0]?.message ?? 'Invalid request',
        issues: error.issues,
      });
    }
    // Our httpError()s and Fastify's own errors (bad JSON, body too large, rate limited)
    // carry a 4xx status code and a message that's safe to show.
    if (error.statusCode && error.statusCode < 500) {
      return reply.status(error.statusCode).send({ error: error.name, message: error.message });
    }
    request.log.error(error);
    return reply
      .status(500)
      .send({ error: 'InternalServerError', message: 'Something went wrong' });
  });

  await app.register(helmet);
  // A general per-IP ceiling. Autosave sends at most ~1 request/second while typing.
  await app.register(rateLimit, { max: 300, timeWindow: '1 minute' });

  app.get('/api/health', async () => ({ ok: true }));
  await app.register(authRoutes, { auth });
  await app.register(noteRoutes, { db, auth, prefix: '/api/notes' });

  return app;
}
