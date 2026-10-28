import type { Note, NoteSummary } from '@cairn/core';
import type { Db, ObjectId } from 'mongodb';

/** A note as stored in MongoDB. The API converts it to `Note` before sending it. */
export interface NoteDoc {
  _id: ObjectId;
  /** Better Auth user id (`session.user.id`). Every query filters on it. */
  userId: string;
  title: string;
  markdown: string;
  tags: string[];
  frontmatter: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const notesCollection = (db: Db) => db.collection<NoteDoc>('notes');

export function toNoteSummary(doc: Omit<NoteDoc, 'markdown' | 'frontmatter'>): NoteSummary {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    tags: doc.tags,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toNote(doc: NoteDoc): Note {
  return { ...toNoteSummary(doc), markdown: doc.markdown, frontmatter: doc.frontmatter };
}
