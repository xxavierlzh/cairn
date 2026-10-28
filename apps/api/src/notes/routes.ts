import {
  type BacklinksResponse,
  createNoteInputSchema,
  listNotesQuerySchema,
  type NotesPage,
  noteIdSchema,
  noteTitleKey,
  updateNoteInputSchema,
} from '@cairn/core';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { type Collection, type Db, type Filter, type MongoClient, ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Auth } from '../auth/auth';
import { protectRoutes } from '../auth/require-user';
import { httpError } from '../lib/http-error';
import { isDuplicateKeyError } from '../lib/mongo-errors';
import { decodeCursor, encodeCursor } from './cursor';
import { renameLinks, resolveLinks } from './links';
import {
  derivedFields,
  type NoteDoc,
  notesCollection,
  SUMMARY_PROJECTION,
  toNote,
  toNoteSummary,
} from './model';

const paramsSchema = z.object({ id: noteIdSchema });

const BACKLINKS_MAX = 100;
const UNTITLED = 'Untitled';

// 404 (not 403) for notes owned by someone else, so ids can't be probed for existence.
const notFound = (reply: FastifyReply) =>
  reply.status(404).send({ error: 'NotFound', message: 'Note not found' });

const titleTaken = (title: string) => httpError(409, `You already have a note called "${title}"`);

const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const noteRoutes: FastifyPluginAsync<{ db: Db; client: MongoClient; auth: Auth }> = async (
  app,
  { db, client, auth },
) => {
  const notes = notesCollection(db);
  protectRoutes(app, auth);

  const send = async (doc: NoteDoc) =>
    toNote(doc, await resolveLinks(notes, doc.userId, doc.markdown));

  app.get('/', async (request): Promise<NotesPage> => {
    const { limit, cursor, tag } = listNotesQuerySchema.parse(request.query);

    const filter: Filter<NoteDoc> = { userId: request.userId };
    if (tag) {
      // The tag itself, or one nested under it: `project` matches `project/cairn`.
      filter.tags = { $in: [tag, new RegExp(`^${escapeRegExp(tag)}/`)] };
    }
    if (cursor) {
      const after = decodeCursor(cursor);
      filter.$or = [
        { updatedAt: { $lt: after.updatedAt } },
        { updatedAt: after.updatedAt, _id: { $lt: after.id } },
      ];
    }

    // Fetch one extra to know whether another page exists, without a separate count query.
    const docs = await notes
      .find(filter, { projection: SUMMARY_PROJECTION })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();

    const page = docs.slice(0, limit);
    const last = page.at(-1);
    return {
      items: page.map(toNoteSummary),
      nextCursor: docs.length > limit && last ? encodeCursor(last) : null,
    };
  });

  app.get('/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const doc = await notes.findOne({ _id: new ObjectId(id), userId: request.userId });
    return doc ? send(doc) : notFound(reply);
  });

  app.get('/:id/backlinks', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const _id = new ObjectId(id);
    const { userId } = request;
    const note = await notes.findOne({ _id, userId }, { projection: { titleKey: 1 } });
    if (!note) return notFound(reply);

    const docs = await notes
      .find({ userId, links: note.titleKey, _id: { $ne: _id } }, { projection: SUMMARY_PROJECTION })
      .sort({ updatedAt: -1, _id: -1 })
      .limit(BACKLINKS_MAX)
      .toArray();
    return { items: docs.map(toNoteSummary) } satisfies BacklinksResponse;
  });

  app.post('/', async (request, reply) => {
    const input = createNoteInputSchema.parse(request.body ?? {});
    const { userId } = request;
    const now = new Date();

    // Two requests can pick the same "Untitled N" at once. The unique index stops the second,
    // and it tries again with the next free number.
    for (let attempt = 1; ; attempt++) {
      const title = input.title ?? (await nextUntitledTitle(notes, userId));
      const doc: NoteDoc = {
        _id: new ObjectId(),
        userId,
        title,
        titleKey: noteTitleKey(title),
        markdown: input.markdown,
        ...derivedFields(input.markdown),
        createdAt: now,
        updatedAt: now,
      };
      try {
        await notes.insertOne(doc);
        return reply.status(201).send(await send(doc));
      } catch (error) {
        if (!isDuplicateKeyError(error)) throw error;
        if (input.title !== undefined || attempt === 3) throw titleTaken(title);
      }
    }
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const input = updateNoteInputSchema.parse(request.body);
    const _id = new ObjectId(id);
    const { userId } = request;

    // A transaction, so a rename and the link rewrites it causes land together or not at all.
    // Last write wins otherwise. Fine for one person editing; real-time collaboration comes with Yjs.
    const doc = await client
      .withSession((session) =>
        session.withTransaction(async () => {
          const current = await notes.findOne({ _id, userId }, { session });
          if (!current) return null;

          const title = input.title ?? current.title;
          const markdown = input.markdown ?? current.markdown;
          const now = new Date();
          const updated = await notes.findOneAndUpdate(
            { _id, userId },
            {
              $set: {
                title,
                titleKey: noteTitleKey(title),
                markdown,
                ...derivedFields(markdown),
                updatedAt: now,
              },
            },
            { session, returnDocument: 'after' },
          );
          if (updated && updated.titleKey !== current.titleKey) {
            await renameLinks(notes, {
              userId,
              noteId: _id,
              from: current.title,
              to: title,
              now,
              session,
            });
          }
          return updated;
        }),
      )
      .catch((error: unknown) => {
        throw isDuplicateKeyError(error) ? titleTaken(input.title ?? '') : error;
      });

    return doc ? send(doc) : notFound(reply);
  });

  app.delete('/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const { deletedCount } = await notes.deleteOne({
      _id: new ObjectId(id),
      userId: request.userId,
    });
    return deletedCount ? reply.status(204).send() : notFound(reply);
  });
};

/** "Untitled", then "Untitled 1", "Untitled 2", ...: the lowest number not in use, like Obsidian. */
async function nextUntitledTitle(notes: Collection<NoteDoc>, userId: string): Promise<string> {
  const taken = await notes
    .find({ userId, titleKey: /^untitled( \d+)?$/ }, { projection: { titleKey: 1 } })
    .toArray();
  const used = new Set(taken.map((doc) => Number(doc.titleKey.slice(UNTITLED.length)) || 0));
  let n = 0;
  while (used.has(n)) n++;
  return n === 0 ? UNTITLED : `${UNTITLED} ${n}`;
}
