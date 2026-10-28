import type { Note } from '@cairn/core';
import type { FastifyInstance, InjectOptions } from 'fastify';
import { type Db, MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { expect } from 'vitest';
import { buildApp } from '../src/app';
import { createAuth } from '../src/auth/auth';
import { ensureIndexes } from '../src/db';
import { envSchema } from '../src/env';

const WEB_ORIGIN = 'http://localhost:3000';

export interface TestApp {
  app: FastifyInstance;
  client: MongoClient;
  db: Db;
  /** Signs up a fresh user and returns API helpers that send their session cookie. */
  signUp: (email: string) => Promise<UserApi>;
  stop: () => Promise<void>;
}

export type UserApi = ReturnType<typeof userApi>;

/** An API server on a throwaway MongoDB. Call `stop()` in `afterAll`. */
export async function startTestApp(): Promise<TestApp> {
  // A one-node replica set, like Atlas, so transactions work.
  const mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  const uri = mongo.getUri('cairn-test');
  const client = new MongoClient(uri);
  await client.connect();
  const db = client.db();
  await ensureIndexes(db);

  const env = envSchema.parse({
    NODE_ENV: 'test',
    MONGODB_URI: uri,
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    BETTER_AUTH_URL: 'http://localhost:4000',
    WEB_ORIGIN,
  });
  const app = await buildApp({ env, db, client, auth: createAuth(env, db, client) });

  async function signUp(email: string): Promise<UserApi> {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-up/email',
      headers: { origin: WEB_ORIGIN },
      payload: { email, password: 'correct-horse-battery-staple', name: 'Test User' },
    });
    expect(res.statusCode, res.body).toBe(200);
    const setCookie = [res.headers['set-cookie'] ?? []].flat();
    return userApi(app, setCookie.map((c) => c.split(';')[0]).join('; '));
  }

  return {
    app,
    client,
    db,
    signUp,
    stop: async () => {
      await app.close();
      await client.close();
      await mongo.stop();
    },
  };
}

function userApi(app: FastifyInstance, cookie: string) {
  const call = (method: InjectOptions['method'], url: string, payload?: object) =>
    app.inject({ method, url: `/api${url}`, headers: { cookie }, payload });
  return {
    list: (query = '') => call('GET', `/notes${query}`),
    get: (id: string) => call('GET', `/notes/${id}`),
    backlinks: (id: string) => call('GET', `/notes/${id}/backlinks`),
    create: (payload: object = {}) => call('POST', '/notes', payload),
    update: (id: string, payload: object) => call('PATCH', `/notes/${id}`, payload),
    remove: (id: string) => call('DELETE', `/notes/${id}`),
    tags: () => call('GET', '/tags'),
    exportVault: () => call('GET', '/export'),
    /** Creates a note and returns it, failing the test if that doesn't work. */
    async note(title: string, markdown = ''): Promise<Note> {
      const res = await call('POST', '/notes', { title, markdown });
      expect(res.statusCode, res.body).toBe(201);
      return res.json<Note>();
    },
  };
}
