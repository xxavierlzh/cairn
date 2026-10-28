// Builds an Obsidian vault (a .zip of Markdown files) from Cairn notes. Platform-agnostic:
// fflate is plain JavaScript, so this runs in Node, browsers and React Native alike.
import { strToU8, Zip, ZipDeflate } from 'fflate';

export interface VaultNote {
  title: string;
  markdown: string;
  /** Becomes the file's modified time, which Obsidian sorts by. */
  updatedAt: Date;
}

/**
 * Where a note lives in the vault. A flat folder of `<title>.md` files, so Obsidian resolves
 * `[[title]]` to it. Titles are unique per user ignoring case, and the API rejects characters
 * and names that filesystems can't store, so every title is already a safe, distinct filename.
 */
export function vaultPath(title: string): string {
  return `${title}.md`;
}

export interface VaultWriter {
  add(note: VaultNote): void;
  /** Writes the zip's index. Call once, after the last note. */
  end(): void;
}

/**
 * Streams notes into a zip. `onData` receives the archive in chunks as each note is
 * compressed, so the whole vault never has to sit in memory. `final` marks the last chunk.
 */
export function createVaultWriter(
  onData: (chunk: Uint8Array, final: boolean) => void,
  onError: (error: Error) => void,
): VaultWriter {
  const zip = new Zip((error, chunk, final) => {
    if (error) onError(error);
    else onData(chunk, final);
  });
  return {
    add({ title, markdown, updatedAt }) {
      const file = new ZipDeflate(vaultPath(title), { level: 6 });
      file.mtime = updatedAt;
      zip.add(file);
      // Byte-for-byte what was saved: frontmatter, links and spacing are left as they are.
      file.push(strToU8(markdown), true);
    },
    end() {
      zip.end();
    },
  };
}
