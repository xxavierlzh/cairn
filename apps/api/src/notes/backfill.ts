import { noteTitleKey } from '@cairn/core';
import type { Db } from 'mongodb';
import { derivedFields, notesCollection } from './model';

/**
 * Notes saved before Phase 3 have no titleKey, links or tags. This fills them in and
 * renumbers duplicate titles (a second "Ideas" becomes "Ideas 1"), oldest note first, so
 * the unique title index can be built. It only reads notes without a titleKey, so once it
 * has run it does nothing.
 */
export async function backfillNotes(db: Db): Promise<number> {
  const notes = notesCollection(db);
  const pending = notes.find({ titleKey: { $exists: false } }).sort({ createdAt: 1, _id: 1 });
  // Only notes already backfilled have a titleKey, so a note never clashes with itself.
  const isTaken = async (userId: string, title: string) =>
    (await notes.countDocuments({ userId, titleKey: noteTitleKey(title) }, { limit: 1 })) > 0;

  let count = 0;
  for await (const doc of pending) {
    let title = doc.title;
    for (let n = 1; await isTaken(doc.userId, title); n++) title = `${doc.title} ${n}`;
    await notes.updateOne(
      { _id: doc._id },
      { $set: { title, titleKey: noteTitleKey(title), ...derivedFields(doc.markdown) } },
    );
    count++;
  }
  return count;
}
