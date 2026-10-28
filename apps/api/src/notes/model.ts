import { analyzeNote, type Note, type NoteLink, type NoteSummary, noteTitleKey } from '@cairn/core';
import type { Db, ObjectId } from 'mongodb';

/** A note as stored in MongoDB. The API converts it to `Note` before sending it. */
export interface NoteDoc {
  _id: ObjectId;
  /** Better Auth user id (`session.user.id`). Every query filters on it. */
  userId: string;
  title: string;
  /** `noteTitleKey(title)`. Unique per user, so [[links]] and exported filenames never clash. */
  titleKey: string;
  markdown: string;
  tags: string[];
  /** `noteTitleKey` of every note this one links to. Backlinks and renames query it. */
  links: string[];
  frontmatter: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

export const notesCollection = (db: Db) => db.collection<NoteDoc>('notes');

/** The fields a note list needs. Pass it as `projection` to skip the heavy ones. */
export const SUMMARY_PROJECTION = { title: 1, tags: 1, createdAt: 1, updatedAt: 1 } as const;

/** Everything worked out from the Markdown. Recompute it whenever `markdown` changes. */
export function derivedFields(markdown: string): Pick<NoteDoc, 'tags' | 'links' | 'frontmatter'> {
  const { frontmatter, tags, links } = analyzeNote(markdown);
  return {
    tags,
    links: [...new Set(links.map((link) => noteTitleKey(link.target)))],
    frontmatter: storableFrontmatter(frontmatter),
  };
}

/**
 * MongoDB won't store field names that start with `$` or contain `.` through an update, so
 * frontmatter keys like that are dropped. The Markdown (the source of truth) still has them.
 */
function storableFrontmatter(value: Record<string, unknown>): Record<string, unknown> {
  const clean = (v: unknown): unknown => {
    if (Array.isArray(v)) return v.map(clean);
    if (v === null || typeof v !== 'object') return v;
    return Object.fromEntries(
      Object.entries(v)
        .filter(([key]) => !key.startsWith('$') && !key.includes('.'))
        .map(([key, inner]) => [key, clean(inner)]),
    );
  };
  return clean(value) as Record<string, unknown>;
}

export function toNoteSummary(
  doc: Pick<NoteDoc, '_id' | 'title' | 'tags' | 'createdAt' | 'updatedAt'>,
): NoteSummary {
  return {
    id: doc._id.toHexString(),
    title: doc.title,
    tags: doc.tags,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function toNote(doc: NoteDoc, links: NoteLink[]): Note {
  return { ...toNoteSummary(doc), markdown: doc.markdown, frontmatter: doc.frontmatter, links };
}
