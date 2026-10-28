import { describe, expect, it } from 'vitest';
import { formatRelativeTime } from './format';
import {
  createNoteInputSchema,
  listNotesQuerySchema,
  NOTE_TITLE_MAX,
  noteIdSchema,
  updateNoteInputSchema,
} from './notes';

describe('createNoteInputSchema', () => {
  it('defaults the body and leaves the title for the server to pick', () => {
    expect(createNoteInputSchema.parse({})).toEqual({ markdown: '' });
  });

  it('trims the title', () => {
    expect(createNoteInputSchema.parse({ title: '  Ideas  ' }).title).toBe('Ideas');
  });

  it.each(['a/b', 'C#', 'x|y', '[[x]]', 'what?', 'a:b', 'ref^1'])(
    'rejects characters Obsidian cannot use in filenames or links: %s',
    (title) => {
      expect(createNoteInputSchema.safeParse({ title }).success).toBe(false);
    },
  );

  it.each(['CON', 'nul', 'com1', 'LPT9', 'aux.txt', '.hidden', 'Trailing.'])(
    "rejects names Windows or Obsidian can't use as files: %s",
    (title) => {
      expect(createNoteInputSchema.safeParse({ title }).success).toBe(false);
    },
  );

  it('allows titles that only start like a reserved name', () => {
    expect(createNoteInputSchema.safeParse({ title: 'Con Air' }).success).toBe(true);
    expect(createNoteInputSchema.safeParse({ title: 'v1.0 notes' }).success).toBe(true);
  });

  it('rejects titles that are blank or too long', () => {
    expect(createNoteInputSchema.safeParse({ title: '   ' }).success).toBe(false);
    expect(createNoteInputSchema.safeParse({ title: 'a'.repeat(NOTE_TITLE_MAX + 1) }).success).toBe(
      false,
    );
  });
});

describe('updateNoteInputSchema', () => {
  it('accepts a partial update', () => {
    expect(updateNoteInputSchema.parse({ markdown: '# Hi' })).toEqual({ markdown: '# Hi' });
  });

  it('rejects an empty update', () => {
    expect(updateNoteInputSchema.safeParse({}).success).toBe(false);
  });
});

describe('listNotesQuerySchema', () => {
  it('coerces limit from a query string and caps it', () => {
    expect(listNotesQuerySchema.parse({ limit: '5' }).limit).toBe(5);
    expect(listNotesQuerySchema.parse({}).limit).toBe(20);
    expect(listNotesQuerySchema.safeParse({ limit: '1000' }).success).toBe(false);
  });

  it('normalizes the tag filter', () => {
    expect(listNotesQuerySchema.parse({ tag: ' Project/Cairn ' }).tag).toBe('project/cairn');
    expect(listNotesQuerySchema.safeParse({ tag: '' }).success).toBe(false);
  });
});

describe('noteIdSchema', () => {
  it('only accepts 24-char hex ids', () => {
    expect(noteIdSchema.safeParse('6720f1a2b3c4d5e6f7a8b9c0').success).toBe(true);
    expect(noteIdSchema.safeParse('not-an-id').success).toBe(false);
  });
});

describe('formatRelativeTime', () => {
  const now = Date.parse('2026-10-26T12:00:00Z');

  it.each([
    ['2026-10-26T11:59:30Z', 'just now'],
    ['2026-10-26T11:55:00Z', '5m ago'],
    ['2026-10-26T09:00:00Z', '3h ago'],
    ['2026-10-24T12:00:00Z', '2d ago'],
    ['2026-09-01T12:00:00Z', '2026-09-01'],
  ])('%s -> %s', (iso, expected) => {
    expect(formatRelativeTime(iso, now)).toBe(expected);
  });
});
