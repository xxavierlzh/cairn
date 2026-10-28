import { fromNodeHeaders } from 'better-auth/node';
import type { FastifyPluginAsync } from 'fastify';
import type { Auth } from './auth';

/**
 * Forwards /api/auth/* to Better Auth. Better Auth speaks the Fetch API (Request/Response),
 * so we convert Fastify's request into a Request and copy the Response back.
 */
export const authRoutes: FastifyPluginAsync<{ auth: Auth }> = async (app, { auth }) => {
  app.route({
    method: ['GET', 'POST'],
    url: '/api/auth/*',
    async handler(request, reply) {
      const url = new URL(request.url, `${request.protocol}://${request.host}`);
      const headers = fromNodeHeaders(request.headers);
      // Better Auth rate-limits by X-Forwarded-For, which any client can fake. Replace it
      // with the IP Fastify worked out (it only trusts proxies listed in TRUST_PROXY).
      headers.set('x-forwarded-for', request.ip);

      const response = await auth.handler(
        new Request(url, {
          method: request.method,
          headers,
          body: request.body ? JSON.stringify(request.body) : undefined,
        }),
      );

      reply.status(response.status);
      // Fastify appends repeated set-cookie headers instead of overwriting them.
      response.headers.forEach((value, key) => {
        reply.header(key, value);
      });
      return reply.send(response.body ? await response.text() : null);
    },
  });
};
