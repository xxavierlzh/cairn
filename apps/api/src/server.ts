import { buildApp } from './app';
import { createAuth } from './auth/auth';
import { connectDb } from './db';
import { loadEnv } from './env';

const env = loadEnv();
const { client, db } = await connectDb(env.MONGODB_URI);
const auth = createAuth(env, db, client);
const app = await buildApp({ env, db, client, auth });

await app.listen({ host: env.HOST, port: env.PORT });

for (const signal of ['SIGINT', 'SIGTERM'] as const) {
  process.once(signal, async () => {
    await app.close();
    await client.close();
    process.exit(0);
  });
}
