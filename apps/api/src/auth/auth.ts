import { expo } from '@better-auth/expo';
import { mongodbAdapter } from '@better-auth/mongo-adapter';
import { betterAuth } from 'better-auth';
import type { Db, MongoClient } from 'mongodb';
import type { Env } from '../env';

export function createAuth(env: Env, db: Db, client: MongoClient) {
  const isProduction = env.NODE_ENV === 'production';

  return betterAuth({
    secret: env.BETTER_AUTH_SECRET,
    baseURL: env.BETTER_AUTH_URL,
    // Passing `client` turns on transactions (Atlas and the local Docker image are replica sets).
    // Better Auth creates its own collections: user, session, account, verification.
    database: mongodbAdapter(db, { client }),
    emailAndPassword: { enabled: true },
    trustedOrigins: [
      env.WEB_ORIGIN,
      'cairn://', // the mobile app's scheme (app.json)
      // Expo Go loads the app from exp://<your-pc-ip>:8081. Never trust this in production.
      ...(isProduction ? [] : ['exp://', 'exp://**']),
    ],
    // Built-in limits, e.g. 3 sign-in attempts per 10s per IP. Stored in memory, which is
    // fine for one server. With several API instances, move this to Redis (secondaryStorage).
    rateLimit: { enabled: env.NODE_ENV !== 'test' },
    plugins: [expo()],
  });
}

export type Auth = ReturnType<typeof createAuth>;
