import { type Db, MongoClient } from 'mongodb';
import { notesCollection } from './notes/model';

export async function connectDb(uri: string): Promise<{ client: MongoClient; db: Db }> {
  const client = new MongoClient(uri);
  await client.connect();
  // The database name comes from the connection string path (".../cairn").
  const db = client.db();
  await ensureIndexes(db);
  return { client, db };
}

/** Idempotent: MongoDB skips indexes that already exist. */
export async function ensureIndexes(db: Db): Promise<void> {
  // Serves the notes list: filter by user, newest first, with _id as the tie-breaker
  // that keeps cursor pagination stable.
  await notesCollection(db).createIndex({ userId: 1, updatedAt: -1, _id: -1 });
}
