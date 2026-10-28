import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { Auth } from './auth';

declare module 'fastify' {
  interface FastifyRequest {
    /** Set by `requireUser`. Only read it in routes that use that hook. */
    userId: string;
  }
}

/**
 * preHandler hook: looks up the session from the cookie and rejects the request with 401
 * if there isn't one. Web sends the cookie automatically; mobile sets the Cookie header.
 */
export function createRequireUser(auth: Auth) {
  return async function requireUser(request: FastifyRequest, reply: FastifyReply) {
    const session = await auth.api.getSession({ headers: fromNodeHeaders(request.headers) });
    if (!session) {
      return reply.status(401).send({ error: 'Unauthorized', message: 'Sign in to continue' });
    }
    request.userId = session.user.id;
  };
}

/** Call at the top of a route plugin: every route in it then needs a signed-in user. */
export function protectRoutes(app: FastifyInstance, auth: Auth): void {
  app.decorateRequest('userId', '');
  app.addHook('preHandler', createRequireUser(auth));
}
