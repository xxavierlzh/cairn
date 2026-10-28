import {
  createNoteInputSchema,
  listNotesQuerySchema,
  type NotesPage,
  noteIdSchema,
  updateNoteInputSchema,
} from '@cairn/core';
import type { FastifyPluginAsync, FastifyReply } from 'fastify';
import { type Db, type Filter, ObjectId } from 'mongodb';
import { z } from 'zod';
import type { Auth } from '../auth/auth';
import { createRequireUser } from '../auth/require-user';
import { decodeCursor, encodeCursor } from './cursor';
import { type NoteDoc, notesCollection, toNote, toNoteSummary } from './model';

const paramsSchema = z.object({ id: noteIdSchema });

// 404 (not 403) for notes owned by someone else, so ids can't be probed for existence.
const notFound = (reply: FastifyReply) =>
  reply.status(404).send({ error: 'NotFound', message: 'Note not found' });

export const noteRoutes: FastifyPluginAsync<{ db: Db; auth: Auth }> = async (app, { db, auth }) => {
  const notes = notesCollection(db);

  app.decorateRequest('userId', '');
  app.addHook('preHandler', createRequireUser(auth));

  app.get('/', async (request): Promise<NotesPage> => {
    const { limit, cursor } = listNotesQuerySchema.parse(request.query);

    const filter: Filter<NoteDoc> = { userId: request.userId };
    if (cursor) {
      const after = decodeCursor(cursor);
      filter.$or = [
        { updatedAt: { $lt: after.updatedAt } },
        { updatedAt: after.updatedAt, _id: { $lt: after.id } },
      ];
    }

    // Fetch one extra to know whether another page exists, without a separate count query.
    const docs = await notes
      .find(filter, { projection: { markdown: 0, frontmatter: 0 } })
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
    return doc ? toNote(doc) : notFound(reply);
  });

  app.post('/', async (request, reply) => {
    const input = createNoteInputSchema.parse(request.body ?? {});
    const now = new Date();
    const doc: NoteDoc = {
      _id: new ObjectId(),
      userId: request.userId,
      title: input.title,
      markdown: input.markdown,
      tags: [],
      frontmatter: {},
      createdAt: now,
      updatedAt: now,
    };
    await notes.insertOne(doc);
    return reply.status(201).send(toNote(doc));
  });

  app.patch('/:id', async (request, reply) => {
    const { id } = paramsSchema.parse(request.params);
    const input = updateNoteInputSchema.parse(request.body);
    // Last write wins. Fine for one person editing; real-time collaboration comes with Yjs.
    const doc = await notes.findOneAndUpdate(
      { _id: new ObjectId(id), userId: request.userId },
      { $set: { ...input, updatedAt: new Date() } },
      { returnDocument: 'after' },
    );
    return doc ? toNote(doc) : notFound(reply);
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
