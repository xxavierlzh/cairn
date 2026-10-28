import { z } from 'zod';

export const NOTE_TITLE_MAX = 200;
export const NOTE_MARKDOWN_MAX = 200_000;
export const NOTES_PAGE_SIZE_MAX = 100;

// Titles become Obsidian filenames and [[wikilink]] targets on export, so we reject the
// characters Obsidian itself refuses in filenames or treats as link syntax (# heading,
// ^ block ref, | alias, [ ] brackets).
const FORBIDDEN_TITLE_CHARS = /[\\/:*?"<>|#^[\]]/;
// Windows refuses these as filenames, even with an extension (CON.md, nul.txt.md).
const WINDOWS_RESERVED_NAME = /^(con|prn|aux|nul|com[0-9¹²³]|lpt[0-9¹²³])(\.|$)/i;

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
  })
  // Obsidian hides files that start with a dot, and Windows drops a trailing one.
  .refine((title) => !title.startsWith('.') && !title.endsWith('.'), {
    error: "Title can't start or end with a dot",
  })
  .refine((title) => !WINDOWS_RESERVED_NAME.test(title), {
    error: "Windows reserves that name, so it can't be a filename",
  });

export const noteMarkdownSchema = z
  .string()
  .max(NOTE_MARKDOWN_MAX, `Note must be at most ${NOTE_MARKDOWN_MAX} characters`);

export const createNoteInputSchema = z.object({
  /** Leave it out to get the next free "Untitled", "Untitled 1", ... */
  title: noteTitleSchema.optional(),
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
  /** Only notes with this tag or a tag nested under it (`project` matches `project/cairn`). */
  tag: z.string().trim().toLowerCase().min(1).max(100).optional(),
});

export type CreateNoteInput = z.input<typeof createNoteInputSchema>;
export type UpdateNoteInput = z.input<typeof updateNoteInputSchema>;

/** A note as the API returns it. Dates are ISO 8601 strings. */
export interface Note {
  id: string;
  title: string;
  markdown: string;
  /** From frontmatter `tags` and inline #tags. Lowercase, without `#`. */
  tags: string[];
  frontmatter: Record<string, unknown>;
  /** Each note this one links to, once, with its id if a note by that title exists. */
  links: NoteLink[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteLink {
  /** The title as written in the first [[link]] to it. Compare with `noteTitleKey`. */
  target: string;
  /** `null` while no note has that title. Obsidian calls these unresolved links. */
  noteId: string | null;
}

/** What the list endpoint returns per note: no body, to keep pages small. */
export type NoteSummary = Pick<Note, 'id' | 'title' | 'tags' | 'createdAt' | 'updatedAt'>;

export interface BacklinksResponse {
  /** Notes that link to this one, most recently edited first. */
  items: NoteSummary[];
}

export interface TagCount {
  tag: string;
  /** How many notes have the tag. */
  count: number;
}

export interface TagsResponse {
  /** Most-used first. */
  tags: TagCount[];
}

export interface NotesPage {
  items: NoteSummary[];
  /** Pass back as `cursor` to get the next page. `null` means this was the last page. */
  nextCursor: string | null;
}
