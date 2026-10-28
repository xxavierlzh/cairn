import type { BacklinksResponse, Note, NotesPage, TagsResponse } from '@cairn/core';
import { ObjectId } from 'mongodb';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { backfillNotes } from '../src/notes/backfill';
import { startTestApp, type TestApp, type UserApi } from './helpers';

let server: TestApp;
let alice: UserApi;
let bob: UserApi;

beforeAll(async () => {
  server = await startTestApp();
  alice = await server.signUp('alice@example.com');
  bob = await server.signUp('bob@example.com');
});

afterAll(async () => {
  await server?.stop();
});

const titles = (res: { json: () => unknown }) =>
  (res.json() as BacklinksResponse | NotesPage).items.map((note) => note.title);

describe('links and backlinks', () => {
  it('resolves outgoing links to note ids, and keeps links to missing notes', async () => {
    const target = await alice.note('Target');
    const source = await alice.note(
      'Source',
      'See [[target|it]], [[Target#Part]] and [[Nowhere]].',
    );

    expect(source.links).toEqual([
      { target: 'target', noteId: target.id },
      { target: 'Nowhere', noteId: null },
    ]);

    // Creating the missing note resolves the link.
    const nowhere = await alice.note('Nowhere');
    const reloaded = (await alice.get(source.id)).json<Note>();
    expect(reloaded.links[1]).toEqual({ target: 'Nowhere', noteId: nowhere.id });
  });

  it('lists the notes that link to a note, newest first', async () => {
    const hub = await alice.note('Hub');
    await alice.note('Spoke A', '[[Hub]]');
    await alice.note('Spoke B', '![[hub]] and `[[Hub]]` in code');
    await alice.note('Self', '[[Self]]');
    await alice.note('Unrelated', '[[Hubcap]]');

    expect(titles(await alice.backlinks(hub.id))).toEqual(['Spoke B', 'Spoke A']);
  });

  it('never shows backlinks from another user', async () => {
    const mine = await alice.note('Shared title');
    await bob.note('Shared title');
    await bob.note('Bob links', '[[Shared title]]');

    expect(titles(await alice.backlinks(mine.id))).toEqual([]);
  });

  it('rewrites links in other notes when a note is renamed', async () => {
    const book = await alice.note('Book');
    const review = await alice.note(
      'Review',
      'Loved [[Book]], esp. [[book#Ending|the ending]]. ![[Book]]\n```\n[[Book]]\n```',
    );
    const untouched = await alice.note('Untouched', '[[Bookshelf]]');

    const renamed = await alice.update(book.id, { title: 'The Book' });
    expect(renamed.statusCode).toBe(200);

    const after = (await alice.get(review.id)).json<Note>();
    expect(after.markdown).toBe(
      'Loved [[The Book]], esp. [[The Book#Ending|the ending]]. ![[The Book]]\n```\n[[Book]]\n```',
    );
    expect(after.links).toEqual([{ target: 'The Book', noteId: book.id }]);
    expect(titles(await alice.backlinks(book.id))).toEqual(['Review']);
    expect((await alice.get(untouched.id)).json<Note>().markdown).toBe('[[Bookshelf]]');
  });

  it("doesn't touch another user's links on rename", async () => {
    const mine = await alice.note('Project');
    const bobs = await bob.note('Bob project link', '[[Project]]');

    await alice.update(mine.id, { title: 'Project renamed' });
    expect((await bob.get(bobs.id)).json<Note>().markdown).toBe('[[Project]]');
  });

  it('rolls back the whole rename when the new title is taken', async () => {
    const first = await alice.note('First');
    await alice.note('Second');
    const linker = await alice.note('Linker', '[[First]]');

    expect((await alice.update(first.id, { title: 'second' })).statusCode).toBe(409);
    expect((await alice.get(first.id)).json<Note>().title).toBe('First');
    expect((await alice.get(linker.id)).json<Note>().markdown).toBe('[[First]]');
  });
});

describe('tags', () => {
  let carol: UserApi;

  beforeAll(async () => {
    carol = await server.signUp('carol@example.com');
    await carol.note('Plan', '---\ntags: [project]\n---\n#project/cairn #todo');
    await carol.note('Reading', '#books #todo');
    await carol.note('Code sample', '```\n#notatag\n```');
  });

  it('stores tags from frontmatter and the body', async () => {
    const page = (await carol.list()).json<NotesPage>();
    const plan = page.items.find((note) => note.title === 'Plan');
    expect(plan?.tags).toEqual(['project', 'project/cairn', 'todo']);
  });

  it('counts tags, most used first', async () => {
    expect((await carol.tags()).json<TagsResponse>().tags).toEqual([
      { tag: 'todo', count: 2 },
      { tag: 'books', count: 1 },
      { tag: 'project', count: 1 },
      { tag: 'project/cairn', count: 1 },
    ]);
  });

  it('filters the notes list by tag, including nested tags', async () => {
    expect(titles(await carol.list('?tag=todo'))).toEqual(['Reading', 'Plan']);
    expect(titles(await carol.list('?tag=Project'))).toEqual(['Plan']);
    expect(titles(await carol.list('?tag=proj'))).toEqual([]);
    // Regex characters in the tag are matched literally.
    expect(titles(await carol.list('?tag=.*'))).toEqual([]);
  });

  it('updates tags when the note changes', async () => {
    const reading = (await carol.list('?tag=books')).json<NotesPage>().items[0];
    await carol.update(reading?.id ?? '', { markdown: 'No tags now' });
    expect(titles(await carol.list('?tag=books'))).toEqual([]);
  });
});

describe('backfillNotes', () => {
  it('fills in derived fields and renumbers duplicate titles, oldest first', async () => {
    const db = server.client.db('cairn-backfill-test');
    const notes = db.collection('notes');
    const base = { userId: 'u1', tags: [], frontmatter: {}, updatedAt: new Date() };
    await notes.insertMany([
      {
        ...base,
        _id: new ObjectId(),
        title: 'Ideas',
        markdown: '[[Plan]] #idea',
        createdAt: new Date(1),
      },
      { ...base, _id: new ObjectId(), title: 'ideas', markdown: '', createdAt: new Date(2) },
      { ...base, _id: new ObjectId(), title: 'Ideas', markdown: '', createdAt: new Date(3) },
      {
        ...base,
        _id: new ObjectId(),
        userId: 'u2',
        title: 'Ideas',
        markdown: '',
        createdAt: new Date(4),
      },
    ]);

    expect(await backfillNotes(db)).toBe(4);
    const docs = await notes.find().sort({ createdAt: 1 }).toArray();
    expect(docs.map((d) => [d.userId, d.title, d.titleKey])).toEqual([
      ['u1', 'Ideas', 'ideas'],
      ['u1', 'ideas 1', 'ideas 1'],
      ['u1', 'Ideas 2', 'ideas 2'],
      ['u2', 'Ideas', 'ideas'],
    ]);
    expect(docs[0]).toMatchObject({ links: ['plan'], tags: ['idea'] });

    // Running it again changes nothing.
    expect(await backfillNotes(db)).toBe(0);
  });
});
