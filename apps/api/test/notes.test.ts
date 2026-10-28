import type { Note, NotesPage } from '@cairn/core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { startTestApp, type TestApp, type UserApi } from './helpers';

let server: TestApp;

beforeAll(async () => {
  server = await startTestApp();
});

afterAll(async () => {
  await server?.stop();
});

describe('notes API', () => {
  let alice: UserApi;
  let bob: UserApi;

  beforeAll(async () => {
    alice = await server.signUp('alice@example.com');
    bob = await server.signUp('bob@example.com');
  });

  it('reports health without auth', async () => {
    const res = await server.app.inject({ method: 'GET', url: '/api/health' });
    expect(res.json()).toEqual({ ok: true });
  });

  it('rejects requests without a session', async () => {
    const res = await server.app.inject({ method: 'GET', url: '/api/notes' });
    expect(res.statusCode).toBe(401);
  });

  it('creates, reads, updates and deletes a note', async () => {
    const created = await alice.create({ title: 'First note', markdown: '# Hello' });
    expect(created.statusCode).toBe(201);
    const note = created.json<Note>();
    expect(note).toMatchObject({ title: 'First note', markdown: '# Hello', tags: [], links: [] });

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

  it('numbers untitled notes like Obsidian: Untitled, Untitled 1, Untitled 2', async () => {
    const notes = [];
    for (let i = 0; i < 3; i++) notes.push((await alice.create()).json<Note>());
    expect(notes.map((n) => n.title)).toEqual(['Untitled', 'Untitled 1', 'Untitled 2']);
    expect(notes[0]?.markdown).toBe('');

    // Deleting one frees its number for the next new note.
    await alice.remove(notes[1]?.id ?? '');
    const next = (await alice.create()).json<Note>();
    expect(next.title).toBe('Untitled 1');

    for (const note of [notes[0], notes[2], next]) await alice.remove(note?.id ?? '');
  });

  it('keeps titles unique per user, ignoring case', async () => {
    const ideas = await alice.note('Ideas');
    const other = await alice.note('Other');

    const duplicate = await alice.create({ title: 'IDEAS' });
    expect(duplicate.statusCode).toBe(409);
    expect(duplicate.json().message).toContain('IDEAS');

    expect((await alice.update(other.id, { title: 'ideas' })).statusCode).toBe(409);
    expect((await alice.get(other.id)).json<Note>().title).toBe('Other');

    // Another user can have a note with the same title.
    expect((await bob.create({ title: 'Ideas' })).statusCode).toBe(201);
    // Changing only the case of your own title is fine.
    expect((await alice.update(ideas.id, { title: 'IDEAS' })).json<Note>().title).toBe('IDEAS');

    await alice.remove(ideas.id);
    await alice.remove(other.id);
  });

  it("keeps each user's notes private", async () => {
    const note = await alice.note('Secret');

    expect((await bob.get(note.id)).statusCode).toBe(404);
    expect((await bob.backlinks(note.id)).statusCode).toBe(404);
    expect((await bob.update(note.id, { title: 'Hacked' })).statusCode).toBe(404);
    expect((await bob.remove(note.id)).statusCode).toBe(404);
    expect((await bob.list()).json<NotesPage>().items.map((n) => n.title)).not.toContain('Secret');

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
    expect(page.items[0]).not.toHaveProperty('links');
  });

  it.each([
    ['a malformed id', () => alice.get('not-an-id')],
    ['an empty update', () => alice.update('6720f1a2b3c4d5e6f7a8b9c0', {})],
    ['a title Obsidian cannot use', () => alice.create({ title: 'C#/notes' })],
    ['a title Windows cannot use', () => alice.create({ title: 'CON' })],
    ['a tampered cursor', () => alice.list('?cursor=garbage')],
  ])('returns 400 for %s', async (_label, request) => {
    const res = await request();
    expect(res.statusCode).toBe(400);
    expect(res.json()).toHaveProperty('message');
  });
});
