import { findWikiLinks, type NoteLink, noteTitleKey, rewriteLinks } from '@cairn/core';
import type { ClientSession, Collection, ObjectId } from 'mongodb';
import { derivedFields, type NoteDoc } from './model';

/** Pairs each note that `markdown` links to with its id, or `null` if there's no such note. */
export async function resolveLinks(
  notes: Collection<NoteDoc>,
  userId: string,
  markdown: string,
): Promise<NoteLink[]> {
  // Key → the spelling of the first link to it, which is what the client shows.
  const targets = new Map<string, string>();
  for (const link of findWikiLinks(markdown)) {
    const key = noteTitleKey(link.target);
    if (!targets.has(key)) targets.set(key, link.target);
  }
  if (targets.size === 0) return [];

  const found = await notes
    .find({ userId, titleKey: { $in: [...targets.keys()] } }, { projection: { titleKey: 1 } })
    .toArray();
  const ids = new Map(found.map((doc) => [doc.titleKey, doc._id.toHexString()]));
  return [...targets].map(([key, target]) => ({ target, noteId: ids.get(key) ?? null }));
}

interface RenameLinksOptions {
  userId: string;
  /** The renamed note. Links inside it are left alone, since its editor holds its own copy. */
  noteId: ObjectId;
  from: string;
  to: string;
  now: Date;
  session: ClientSession;
}

/**
 * After a rename, points `[[from]]` links in the user's other notes at `to`, as Obsidian does.
 * Run it in the same transaction as the rename, so links never point at a missing title.
 */
export async function renameLinks(
  notes: Collection<NoteDoc>,
  { userId, noteId, from, to, now, session }: RenameLinksOptions,
): Promise<void> {
  // Loads every linking note at once. Fine while a note has hundreds of backlinks, not millions.
  const linking = await notes
    .find(
      { userId, links: noteTitleKey(from), _id: { $ne: noteId } },
      { session, projection: { markdown: 1 } },
    )
    .toArray();
  if (linking.length === 0) return;

  await notes.bulkWrite(
    linking.map((doc) => {
      const markdown = rewriteLinks(doc.markdown, from, to);
      return {
        updateOne: {
          filter: { _id: doc._id },
          update: { $set: { markdown, ...derivedFields(markdown), updatedAt: now } },
        },
      };
    }),
    { session },
  );
}
