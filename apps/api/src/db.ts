import { type Db, MongoClient } from 'mongodb';
import { backfillNotes } from './notes/backfill';
import { notesCollection } from './notes/model';

export async function connectDb(uri: string): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(uri);
  await client.connect();
  // The database name comes from the connection string path (".../cairn").
  const db = client.db();
  // Before the indexes: the unique title index can't be built over duplicate titles.
  await backfillNotes(db);
  await ensureIndexes(db);
  return { client, db };
}

/** Idempotent: MongoDB skips indexes that already exist. */
export async function ensureIndexes(db: Db): Promise<void> {
  const notes = notesCollection(db);
  // Serves the notes list: filter by user, newest first, with _id as the tie-breaker
  // that keeps cursor pagination stable.
  await notes.createIndex({ userId: 1, updatedAt: -1, _id: -1 });
  // One note per title per user (ignoring case), so [[links]] and vault filenames are unambiguous.
  await notes.createIndex({ userId: 1, titleKey: 1 }, { unique: true });
  // Backlinks and renames: "which of my notes link to this title?"
  await notes.createIndex({ userId: 1, links: 1 });
  // The notes list filtered by tag.
  await notes.createIndex({ userId: 1, tags: 1, updatedAt: -1, _id: -1 });
}
