import type { Note, NotesPage } from '@cairn/core';
import type { FastifyInstance } from 'fastify';
import { MongoClient } from 'mongodb';
import { MongoMemoryReplSet } from 'mongodb-memory-server';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app';
import { createAuth } from '../src/auth/auth';
import { ensureIndexes } from '../src/db';
import { envSchema } from '../src/env';

const WEB_ORIGIN = 'http://localhost:3000';

let mongo: MongoMemoryReplSet;
let client: MongoClient;
let app: FastifyInstance;

beforeAll(async () => {
  // A one-node replica set, like Atlas, so Better Auth's transactions work.
  mongo = await MongoMemoryReplSet.create({ replSet: { count: 1 } });
  client = new MongoClient(mongo.getUri('cairn-test'));
  await client.connect();
  const db = client.db();
  await ensureIndexes(db);

  const env = envSchema.parse({
    NODE_ENV: 'test',
    MONGODB_URI: mongo.getUri('cairn-test'),
    BETTER_AUTH_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    BETTER_AUTH_URL: 'http://localhost:4000',
    WEB_ORIGIN,
  });
  app = await buildApp({ env, db, auth: createAuth(env, db, client) });
});

afterAll(async () => {
  await app?.close();
  await client?.close();
  await mongo?.stop();
});

/** Signs up a fresh user and returns a Cookie header carrying their session. */
async function signUp(email: string): Promise<string> {
  const res = await app.inject({
    method: 'POST',
    url: '/api/auth/sign-up/email',
    headers: { origin: WEB_ORIGIN },
    payload: { email, password: 'correct-horse-battery-staple', name: 'Test User' },
  });
  expect(res.statusCode, res.body).toBe(200);
  const setCookie = [res.headers['set-cookie'] ?? []].flat();
  return setCookie.map((c) => c.split(';')[0]).join('; ');
}

function api(cookie: string) {
  const call = (method: 'GET' | 'POST' | 'PATCH' | 'DELETE', url: string, payload?: object) =>
    app.inject({ method, url: `/api/notes${url}`, headers: { cookie }, payload });
  return {
    list: (query = '') => call('GET', query),
    get: (id: string) => call('GET', `/${id}`),
    create: (payload: object = {}) => call('POST', '', payload),
    update: (id: string, payload: object) => call('PATCH', `/${id}`, payload),
    remove: (id: string) => call('DELETE', `/${id}`),
  };
}

describe('notes API', () => {
  let alice: ReturnType<typeof api>;
  let bob: ReturnType<typeof api>;

  beforeAll(async () => {
    alice = api(await signUp('alice@example.com'));
    bob = api(await signUp('bob@example.com'));
  });

  it('reports health without auth', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/health' });
    expect(res.json()).toEqual({ ok: true });
  });

  it('rejects requests without a session', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/notes' });
    expect(res.statusCode).toBe(401);
  });

  it('creates, reads, updates and deletes a note', async () => {
    const created = await alice.create({ title: 'First note', markdown: '# Hello' });
    expect(created.statusCode).toBe(201);
    const note = created.json<Note>();
    expect(note).toMatchObject({ title: 'First note', markdown: '# Hello', tags: [] });

    expect((await alice.get(note.id)).json<Note>().markdown).toBe('# Hello');

    const updated = await alice.update(note.id, { markdown: '# Hello again' });
    expect(updated.statusCode).toBe(200);
    expect(updated.json<Note>()).toMatchObject({ title: 'First note', markdown: '# Hello again' });
    expect(Date.parse(updated.json<Note>().updatedAt)).toBeGreaterThanOrEqual(
      Date.parse(note.updatedAt),
    );

    expect((await alice.remove(note.id)).statusCode).toBe(204);
    expect((await alice.get(note.id)).statusCode).toBe(404);
  });

  it('defaults the title and body of a new note', async () => {
    const note = (await alice.create()).json<Note>();
    expect(note).toMatchObject({ title: 'Untitled', markdown: '' });
    await alice.remove(note.id);
  });

  it("keeps each user's notes private", async () => {
    const note = (await alice.create({ title: 'Secret' })).json<Note>();

    expect((await bob.get(note.id)).statusCode).toBe(404);
    expect((await bob.update(note.id, { title: 'Hacked' })).statusCode).toBe(404);
    expect((await bob.remove(note.id)).statusCode).toBe(404);
    expect((await bob.list()).json<NotesPage>().items).toEqual([]);

    expect((await alice.get(note.id)).json<Note>().title).toBe('Secret');
    await alice.remove(note.id);
  });

  it('paginates newest first with a cursor, without gaps or duplicates', async () => {
    const titles = ['One', 'Two', 'Three', 'Four', 'Five'];
    for (const title of titles) await alice.create({ title });

    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const query: string = `?limit=2${cursor ? `&cursor=${cursor}` : ''}`;
      const page: NotesPage = (await alice.list(query)).json();
      expect(page.items.length).toBeLessThanOrEqual(2);
      seen.push(...page.items.map((n) => n.title));
      cursor = page.nextCursor;
    } while (cursor);

    expect(seen).toEqual([...titles].reverse());
  });

  it('leaves the Markdown body out of list results', async () => {
    const page = (await alice.list('?limit=1')).json<NotesPage>();
    expect(page.items[0]).not.toHaveProperty('markdown');
  });

  it.each([
    ['a malformed id', () => alice.get('not-an-id')],
    ['an empty update', () => alice.update('6720f1a2b3c4d5e6f7a8b9c0', {})],
    ['a title Obsidian cannot use', () => alice.create({ title: 'C#/notes' })],
    ['a tampered cursor', () => alice.list('?cursor=garbage')],
  ])('returns 400 for %s', async (_label, request) => {
    const res = await request();
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('message');
  });
});
