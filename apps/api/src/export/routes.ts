import { Readable } from 'node:stream';
import { createVaultWriter, type VaultNote } from '@cairn/export';
import type { FastifyPluginAsync } from 'fastify';
import type { Db } from 'mongodb';
import type { Auth } from '../auth/auth';
import { protectRoutes } from '../auth/require-user';
import { notesCollection } from '../notes/model';

export const exportRoutes: FastifyPluginAsync<{ db: Db; auth: Auth }> = async (
  app,
  { db, auth },
) => {
  const notes = notesCollection(db);
  protectRoutes(app, auth);

  // Reads every note the user has, so it gets a much lower limit than other routes.
  app.get(
    '/',
    { config: { rateLimit: { max: 5, timeWindow: '1 minute' } } },
    async (request, reply) => {
      const cursor = notes
        .find({ userId: request.userId }, { projection: { title: 1, markdown: 1, updatedAt: 1 } })
        .sort({ titleKey: 1 });

      const date = new Date().toISOString().slice(0, 10);
      return reply
        .type('application/zip')
        .header('content-disposition', `attachment; filename="cairn-vault-${date}.zip"`)
        .send(Readable.from(zipChunks(cursor), { objectMode: false }));
    },
  );
};

/**
 * Yields the zip a note at a time. Readable.from only pulls the next note once the client
 * has taken the last chunk, so a slow download never piles the vault up in memory, and a
 * cancelled one stops the loop and closes the cursor.
 */
async function* zipChunks(notes: AsyncIterable<VaultNote>): AsyncGenerator<Uint8Array> {
  const ready: Uint8Array[] = [];
  let failure: Error | undefined;
  const writer = createVaultWriter(
    (chunk) => ready.push(chunk),
    (error) => {
      failure = error;
    },
  );

  for await (const note of notes) {
    writer.add(note);
    if (failure) throw failure;
    yield* ready.splice(0);
  }
  writer.end();
  if (failure) throw failure;
  yield* ready.splice(0);
}
