import { parse as parseYaml } from 'yaml';
import { noteTitleKey } from './notes';

// Parses the parts of a note's Markdown that Obsidian gives meaning to: frontmatter,
// [[wikilinks]] and #tags. Code blocks and inline code are skipped, as they are in Obsidian.

export interface WikiLink {
  /** The title of the note being linked to, as written (any `.md` suffix removed). */
  target: string;
  /** `Heading` in `[[Note#Heading]]`, or `^id` in `[[Note#^id]]` (a block reference). */
  subpath?: string;
  /** `text` in `[[Note|text]]`. */
  alias?: string;
  /** `![[Note]]` embeds the note rather than linking to it. */
  embed: boolean;
  /** Offsets of the whole link, from `[[` (or `![[`) to after `]]`. */
  start: number;
  end: number;
  /** Offsets of `target` alone, so a rename can replace just that part. */
  targetStart: number;
  targetEnd: number;
}

export interface NoteAnalysis {
  frontmatter: Record<string, unknown>;
  /** Lowercased, without `#`, deduplicated. From frontmatter `tags` and inline #tags. */
  tags: string[];
  links: WikiLink[];
}

interface InlineTag {
  tag: string;
  start: number;
  end: number;
}

interface Scan extends NoteAnalysis {
  /** Where the body starts: just after the closing `---` of the frontmatter, or 0. */
  bodyStart: number;
  inlineTags: InlineTag[];
}

export function analyzeNote(markdown: string): NoteAnalysis {
  const { frontmatter, tags, links } = scan(markdown);
  return { frontmatter, tags, links };
}

export function findWikiLinks(markdown: string): WikiLink[] {
  return scan(markdown).links;
}

/**
 * Points every link to `from` at `to` instead, as Obsidian does when you rename a note.
 * Matching ignores case. Aliases, headings and `![[embeds]]` are kept.
 */
export function rewriteLinks(markdown: string, from: string, to: string): string {
  const key = noteTitleKey(from);
  let out = '';
  let last = 0;
  for (const link of findWikiLinks(markdown)) {
    if (noteTitleKey(link.target) !== key) continue;
    out += markdown.slice(last, link.targetStart) + to;
    last = link.targetEnd;
  }
  return out + markdown.slice(last);
}

const NOTE_HREF = 'cairn:note/';
const TAG_HREF = 'cairn:tag/';

export type PreviewHref = { kind: 'note'; title: string } | { kind: 'tag'; tag: string };

/**
 * Turns a note into plain Markdown that any renderer can show: drops the frontmatter, and
 * rewrites wikilinks and tags as ordinary links with `cairn:` hrefs. Read those hrefs back
 * with `parsePreviewHref` when rendering or tapping a link.
 */
export function toPreviewMarkdown(markdown: string): string {
  const { bodyStart, links, inlineTags } = scan(markdown);
  const replacements = [
    ...links
      .filter((link) => link.start >= bodyStart)
      .map((link) => ({
        start: link.start,
        end: link.end,
        text: `[${escapeLabel(linkLabel(link))}](${NOTE_HREF}${encodeURIComponent(link.target)})`,
      })),
    ...inlineTags.map(({ tag, start, end }) => ({
      start,
      end,
      text: `[${escapeLabel(markdown.slice(start, end))}](${TAG_HREF}${encodeURIComponent(tag)})`,
    })),
  ].sort((a, b) => a.start - b.start);

  let out = '';
  let last = bodyStart;
  for (const { start, end, text } of replacements) {
    out += markdown.slice(last, start) + text;
    last = end;
  }
  return out + markdown.slice(last);
}

export function parsePreviewHref(href: string | undefined): PreviewHref | null {
  if (!href) return null;
  try {
    if (href.startsWith(NOTE_HREF)) {
      return { kind: 'note', title: decodeURIComponent(href.slice(NOTE_HREF.length)) };
    }
    if (href.startsWith(TAG_HREF)) {
      return { kind: 'tag', tag: decodeURIComponent(href.slice(TAG_HREF.length)) };
    }
  } catch {
    // Malformed %-escapes: treat it as an ordinary link.
  }
  return null;
}

/** What Obsidian shows for a link: the alias, else `Note > Heading`, else the title. */
function linkLabel(link: WikiLink): string {
  if (link.alias) return link.alias;
  return link.subpath ? `${link.target} > ${link.subpath}` : link.target;
}

function escapeLabel(text: string): string {
  return text.replace(/[\\`*_~<]/g, '\\$&');
}

function scan(markdown: string): Scan {
  const { data: frontmatter, end: bodyStart } = splitFrontmatter(markdown);
  // Same length as the original with code blanked out, so offsets still line up.
  const masked = markdown.slice(0, bodyStart) + maskCode(markdown.slice(bodyStart));
  const links = findLinks(masked);

  // Tags only count in the body (YAML uses # for comments), and never inside a link.
  let tagText = blank(masked.slice(0, bodyStart));
  let last = bodyStart;
  for (const link of links) {
    if (link.start < bodyStart) continue;
    tagText += masked.slice(last, link.start) + blank(masked.slice(link.start, link.end));
    last = link.end;
  }
  tagText += masked.slice(last);
  const inlineTags = findInlineTags(tagText);

  const tags = new Set([...frontmatterTags(frontmatter), ...inlineTags.map((t) => t.tag)]);
  return { frontmatter, tags: [...tags], links, bodyStart, inlineTags };
}

// Frontmatter must start on the very first line, as in Obsidian.
const FRONTMATTER = /^---[ \t]*\r?\n(?:([\s\S]*?)\r?\n)?---[ \t]*(?:\r?\n|$)/;

function splitFrontmatter(markdown: string): { data: Record<string, unknown>; end: number } {
  const match = FRONTMATTER.exec(markdown);
  if (!match) return { data: {}, end: 0 };
  let data: unknown;
  try {
    // The core schema only produces plain JSON values: no dates, no custom types.
    data = parseYaml(match[1] ?? '', { schema: 'core' });
  } catch {
    // Invalid YAML. Obsidian shows it as a broken property block; we just ignore it.
  }
  const isObject = typeof data === 'object' && data !== null && !Array.isArray(data);
  return { data: isObject ? (data as Record<string, unknown>) : {}, end: match[0].length };
}

function frontmatterTags(frontmatter: Record<string, unknown>): string[] {
  // `tag` is the old spelling, which Obsidian still reads.
  const raw = frontmatter.tags ?? frontmatter.tag;
  const values = Array.isArray(raw) ? raw : typeof raw === 'string' ? raw.split(/[\s,]+/) : [];
  return values
    .filter((value) => typeof value === 'string' || typeof value === 'number')
    .map((value) => normalizeTag(String(value).trim().replace(/^#/, '')))
    .filter((tag): tag is string => tag !== null && TAG_BODY_ONLY.test(tag));
}

const TAG_CHAR = '[\\p{L}\\p{N}\\p{M}_\\-/]';
const TAG_BODY_ONLY = new RegExp(`^${TAG_CHAR}+$`, 'u');
// A tag starts a line or follows whitespace, so `C#`, `page#anchor` and `&#123;` aren't tags.
const INLINE_TAG = new RegExp(`(^|\\s)#(${TAG_CHAR}+)`, 'gu');

function findInlineTags(text: string): InlineTag[] {
  const tags: InlineTag[] = [];
  for (const match of text.matchAll(INLINE_TAG)) {
    const tag = normalizeTag(match[2] ?? '');
    if (!tag) continue;
    const start = match.index + (match[1]?.length ?? 0);
    tags.push({ tag, start, end: start + 1 + (match[2]?.length ?? 0) });
  }
  return tags;
}

/** Lowercase, no leading or trailing `/`. Null if it isn't a valid tag (e.g. `#2026`). */
function normalizeTag(raw: string): string | null {
  const tag = raw.replace(/^\/+|\/+$/g, '').toLowerCase();
  // Obsidian needs at least one character that isn't a digit.
  return tag && !/^[\d/]+$/.test(tag) ? tag : null;
}

const WIKILINK = /(!?)\[\[([^[\]\n]*)\]\]/g;

function findLinks(masked: string): WikiLink[] {
  const links: WikiLink[] = [];
  for (const match of masked.matchAll(WIKILINK)) {
    const embed = match[1] === '!';
    const inner = match[2] ?? '';
    const innerStart = match.index + (embed ? 3 : 2);

    // In a table, the alias pipe is written `\|` so it doesn't split the cell.
    const pipe = inner.indexOf('|');
    const linkPart = pipe < 0 ? inner : inner.slice(0, inner[pipe - 1] === '\\' ? pipe - 1 : pipe);
    const alias = pipe < 0 ? undefined : inner.slice(pipe + 1).trim() || undefined;

    const hash = linkPart.indexOf('#');
    const pathPart = hash < 0 ? linkPart : linkPart.slice(0, hash);
    const subpath = hash < 0 ? undefined : linkPart.slice(hash + 1).trim() || undefined;

    const leading = pathPart.length - pathPart.trimStart().length;
    const target = pathPart.trim().replace(/\.md$/i, '');
    // `[[#Heading]]` points inside the same note, not at another one.
    if (!target) continue;

    const targetStart = innerStart + leading;
    links.push({
      target,
      subpath,
      alias,
      embed,
      start: match.index,
      end: match.index + match[0].length,
      targetStart,
      targetEnd: targetStart + target.length,
    });
  }
  return links;
}

/** Replaces everything except line breaks with spaces, keeping offsets intact. */
function blank(text: string): string {
  return text.replace(/[^\r\n]/g, ' ');
}

// An opening fence: 3+ backticks or tildes, allowing indentation and blockquote markers.
const FENCE = /^[ \t]*(?:>[ \t]*)*(`{3,}|~{3,})/;

/** Blanks out fenced code blocks and `inline code`, where links and tags don't count. */
function maskCode(text: string): string {
  const lines = text.split('\n');
  let fence: string | null = null;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i] ?? '';
    const marker = FENCE.exec(line)?.[1];
    if (fence === null) {
      if (!marker) continue;
      fence = marker;
    } else if (
      marker !== undefined &&
      marker[0] === fence[0] &&
      marker.length >= fence.length &&
      line.trim().replace(/^(?:>\s*)*/, '') === marker
    ) {
      fence = null;
    }
    lines[i] = blank(line);
  }
  return maskInlineCode(lines.join('\n'));
}

/**
 * A run of N backticks opens a code span that the next run of exactly N backticks closes.
 * Spans can wrap onto the next line but not past a blank line (the end of a paragraph).
 */
function maskInlineCode(text: string): string {
  const runs = [...text.matchAll(/`+/g)].map((m) => ({ start: m.index, length: m[0].length }));
  const blankLine = /\n[ \t]*\r?\n/g;
  let out = '';
  let last = 0;
  let i = 0;
  while (i < runs.length) {
    const open = runs[i] as (typeof runs)[number];
    const openEnd = open.start + open.length;
    blankLine.lastIndex = openEnd;
    const paragraphEnd = blankLine.exec(text)?.index ?? text.length;

    let close = -1;
    for (let j = i + 1; j < runs.length && (runs[j]?.start ?? 0) < paragraphEnd; j++) {
      if (runs[j]?.length === open.length) {
        close = j;
        break;
      }
    }
    if (close < 0) {
      i++;
      continue;
    }
    const end = (runs[close]?.start ?? 0) + open.length;
    out += text.slice(last, open.start) + blank(text.slice(open.start, end));
    last = end;
    i = close + 1;
  }
  return out + text.slice(last);
}
