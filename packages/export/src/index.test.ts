import { strFromU8, unzipSync } from 'fflate';
import { describe, expect, it } from 'vitest';
import { createVaultWriter, type VaultNote, vaultPath } from './index';

function buildVault(notes: VaultNote[]): Uint8Array {
  const chunks: Uint8Array[] = [];
  let finished = false;
  const writer = createVaultWriter(
    (chunk, final) => {
      chunks.push(chunk);
      finished = final;
    },
    (error) => {
      throw error;
    },
  );
  for (const note of notes) writer.add(note);
  writer.end();
  expect(finished).toBe(true);

  const zip = new Uint8Array(chunks.reduce((size, chunk) => size + chunk.length, 0));
  let offset = 0;
  for (const chunk of chunks) {
    zip.set(chunk, offset);
    offset += chunk.length;
  }
  return zip;
}

const updatedAt = new Date('2026-10-28T09:30:00Z');

describe('createVaultWriter', () => {
  it('writes one Markdown file per note, unchanged', () => {
    const markdown = '---\ntags: [x]\n---\n# Hello\n\nSee [[Other note|this]].\n';
    const files = unzipSync(
      buildVault([
        { title: 'Hello', markdown, updatedAt },
        { title: 'Other note', markdown: '', updatedAt },
      ]),
    );

    expect(Object.keys(files)).toEqual(['Hello.md', 'Other note.md']);
    expect(strFromU8(files['Hello.md'] ?? new Uint8Array())).toBe(markdown);
    expect(files['Other note.md']?.length).toBe(0);
  });

  it('keeps non-English titles and content intact', () => {
    const files = unzipSync(
      buildVault([{ title: '学习笔记 ☕', markdown: '你好 #学习', updatedAt }]),
    );
    expect(strFromU8(files['学习笔记 ☕.md'] ?? new Uint8Array())).toBe('你好 #学习');
  });

  it('produces a valid, empty zip with no notes', () => {
    expect(unzipSync(buildVault([]))).toEqual({});
  });
});

describe('vaultPath', () => {
  it('is the title plus .md, so [[title]] resolves to it', () => {
    expect(vaultPath('v1.0 notes')).toBe('v1.0 notes.md');
  });
});
