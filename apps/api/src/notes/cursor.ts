import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { httpError } from '../lib/http-error';

// A cursor marks the last note of a page: its updatedAt plus _id (to break ties).
// It's base64url JSON, so it's opaque to clients but easy to debug.
const cursorSchema = z.object({ u: z.iso.datetime(), i: z.string().regex(/^[a-f\d]{24}$/i) });

export function encodeCursor(doc: { _id: ObjectId; updatedAt: Date }): string {
  const json = JSON.stringify({ u: doc.updatedAt.toISOString(), i: doc._id.toHexString() });
  return Buffer.from(json).toString('base64url');
}

export function decodeCursor(cursor: string): { updatedAt: Date; id: ObjectId } {
  try {
    const raw = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    const { u, i } = cursorSchema.parse(raw);
    return { updatedAt: new Date(u), id: new ObjectId(i) };
  } catch {
    throw httpError(400, 'Invalid cursor');
  }
}
