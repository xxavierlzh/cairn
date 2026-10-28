import { z } from 'zod';

export const NOTE_TITLE_MAX = 200;
export const NOTE_MARKDOWN_MAX = 200_000;
export const NOTES_PAGE_SIZE_MAX = 100;

// Titles become Obsidian filenames and [[wikilink]] targets on export, so we reject the
// characters Obsidian itself refuses in filenames or treats as link syntax (# heading,
// ^ block ref, | alias, [ ] brackets).
const FORBIDDEN_TITLE_CHARS = /[\\/:*?"<>|#^[\]]/;

/**
 * What makes two titles "the same note": [[wikilinks]] ignore case, and so do the Windows
 * and macOS filesystems a vault gets exported to. NFC makes é typed two ways compare equal.
 */
export function noteTitleKey(title: string): string {
  return title.trim().normalize('NFC').toLowerCase();
}

/** A MongoDB ObjectId as a 24-character hex string. */
export const noteIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid note id');

export const noteTitleSchema = z
  .string()
  .trim()
  .min(1, 'Title is required')
  .max(NOTE_TITLE_MAX, `Title must be at most ${NOTE_TITLE_MAX} characters`)
  .refine((title) => !FORBIDDEN_TITLE_CHARS.test(title), {
    error: 'Title can\'t contain \\ / : * ? " < > | # ^ [ ]',
  });

export const noteMarkdownSchema = z
  .string()
  .max(NOTE_MARKDOWN_MAX, `Note must be at most ${NOTE_MARKDOWN_MAX} characters`);

export const createNoteInputSchema = z.object({
  title: noteTitleSchema.default('Untitled'),
  markdown: noteMarkdownSchema.default(''),
});

export const updateNoteInputSchema = z
  .object({ title: noteTitleSchema, markdown: noteMarkdownSchema })
  .partial()
  .refine((input) => input.title !== undefined || input.markdown !== undefined, {
    error: 'Nothing to update',
  });

export const listNotesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(NOTES_PAGE_SIZE_MAX).default(20),
  cursor: z.string().max(200).optional(),
});

export type CreateNoteInput = z.input<typeof createNoteInputSchema>;
export type UpdateNoteInput = z.input<typeof updateNoteInputSchema>;

/** A note as the API returns it. Dates are ISO 8601 strings. */
export interface Note {
  id: string;
  title: string;
  markdown: string;
  /** Derived from the Markdown (frontmatter + #tags) starting in Phase 3. */
  tags: string[];
  frontmatter: Record<string, unknown>;
  createdAt: string;
  updatedAt: string;
}

/** What the list endpoint returns per note: no body, to keep pages small. */
export type NoteSummary = Pick<Note, 'id' | 'title' | 'tags' | 'createdAt' | 'updatedAt'>;

export interface NotesPage {
  items: NoteSummary[];
  /** Pass back as `cursor` to get the next page. `null` means this was the last page. */
  nextCursor: string | null;
}
