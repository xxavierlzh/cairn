import { describe, expect, it } from 'vitest';
import {
  analyzeNote,
  findWikiLinks,
  parsePreviewHref,
  rewriteLinks,
  toPreviewMarkdown,
} from './markdown';
import { noteTitleKey } from './notes';

const targets = (markdown: string) => findWikiLinks(markdown).map((link) => link.target);
const tags = (markdown: string) => analyzeNote(markdown).tags;

describe('findWikiLinks', () => {
  it('parses targets, headings, block refs, aliases and embeds', () => {
    const [plain, heading, block, alias, embed] = findWikiLinks(
      '[[Plain]] [[Doc#Setup]] [[Doc#^abc123]] [[Doc|the doc]] ![[Diagram]]',
    );
    expect(plain).toMatchObject({ target: 'Plain', embed: false });
    expect(heading).toMatchObject({ target: 'Doc', subpath: 'Setup' });
    expect(block).toMatchObject({ target: 'Doc', subpath: '^abc123' });
    expect(alias).toMatchObject({ target: 'Doc', alias: 'the doc' });
    expect(embed).toMatchObject({ target: 'Diagram', embed: true });
  });

  it('reports offsets of the whole link and of the target', () => {
    const markdown = 'See ![[ My Note.md#Intro|intro]].';
    const [link] = findWikiLinks(markdown);
    expect(link).toBeDefined();
    if (!link) return;
    expect(markdown.slice(link.start, link.end)).toBe('![[ My Note.md#Intro|intro]]');
    expect(markdown.slice(link.targetStart, link.targetEnd)).toBe('My Note');
  });

  it('reads the escaped pipe used inside tables', () => {
    expect(findWikiLinks('| [[Doc\\|alias]] |')[0]).toMatchObject({
      target: 'Doc',
      alias: 'alias',
    });
  });

  it('skips links into the same note and empty links', () => {
    expect(targets('[[#Heading]] [[]] [[ ]]')).toEqual([]);
  });

  it('ignores links in fenced and inline code', () => {
    const markdown = [
      '[[Before]]',
      '```js',
      'const x = "[[Inside fence]]";',
      '```',
      '~~~~',
      '[[Inside tildes]]',
      '~~~~',
      'Use `[[not a link]]` or ``[[nor `this`]]`` here, then [[After]].',
    ].join('\n');
    expect(targets(markdown)).toEqual(['Before', 'After']);
  });

  it('treats an unclosed fence as code until the end', () => {
    expect(targets('[[Yes]]\n```\n[[No]]')).toEqual(['Yes']);
  });

  it("doesn't let an unmatched backtick hide the rest of the note", () => {
    expect(targets('A stray ` backtick.\n\nThen [[Link]].')).toEqual(['Link']);
  });

  it('finds links in frontmatter values, as Obsidian properties do', () => {
    expect(targets('---\nrelated: "[[Other]]"\n---\nBody')).toEqual(['Other']);
  });
});

describe('tags', () => {
  it('finds inline tags, including nested ones, lowercased and deduplicated', () => {
    expect(tags('#Idea and #project/cairn, plus #idea again.\n#todo')).toEqual([
      'idea',
      'project/cairn',
      'todo',
    ]);
  });

  it('reads frontmatter tags as a list or a string', () => {
    expect(tags('---\ntags: [Reading, "#books"]\n---\n')).toEqual(['reading', 'books']);
    expect(tags('---\ntags: one, two three\n---\n')).toEqual(['one', 'two', 'three']);
    expect(tags('---\ntag: legacy\n---\n')).toEqual(['legacy']);
  });

  it.each([
    ['a heading', '# Heading\n## Another'],
    ['a URL fragment', 'https://example.com/page#section'],
    ['a word with # in it', 'C# and F#'],
    ['an HTML entity', '&#123;'],
    ['all digits', 'Issue #2026'],
    ['inline code', '`#notatag`'],
    ['a fenced block', '```\n#notatag\n```'],
    ['a YAML comment', '---\ntitle: x # comment\n---\n'],
    ['a wikilink alias', '[[Doc| #notatag]]'],
  ])('ignores %s', (_label, markdown) => {
    expect(tags(markdown)).toEqual([]);
  });

  it('accepts non-English tags', () => {
    expect(tags('#学习 #café')).toEqual(['学习', 'café']);
  });
});

describe('analyzeNote', () => {
  it('parses frontmatter into plain values and merges both kinds of tags', () => {
    const result = analyzeNote('---\ntitle: Hi\ncount: 3\ntags: [a]\n---\n# Body #b');
    expect(result.frontmatter).toEqual({ title: 'Hi', count: 3, tags: ['a'] });
    expect(result.tags).toEqual(['a', 'b']);
  });

  it('ignores frontmatter that is invalid YAML or not a mapping', () => {
    expect(analyzeNote('---\n: : bad\n  - x\n---\n').frontmatter).toEqual({});
    expect(analyzeNote('---\n- a list\n---\n').frontmatter).toEqual({});
  });

  it('only reads frontmatter at the very start of the note', () => {
    expect(analyzeNote('Intro\n---\ntags: [x]\n---\n').tags).toEqual([]);
  });
});

describe('rewriteLinks', () => {
  it('renames every form of link to a note, ignoring case', () => {
    const before =
      '[[Old]] [[old#Part]] [[OLD|alias]] ![[Old]] [[Old.md]] [[Older]] `[[Old]]` | [[Old\\|x]] |';
    expect(rewriteLinks(before, 'Old', 'New Name')).toBe(
      '[[New Name]] [[New Name#Part]] [[New Name|alias]] ![[New Name]] [[New Name.md]] [[Older]] `[[Old]]` | [[New Name\\|x]] |',
    );
  });

  it('leaves notes without matching links untouched', () => {
    const markdown = '# Title\n\n[[Other]] text';
    expect(rewriteLinks(markdown, 'Old', 'New')).toBe(markdown);
  });
});

describe('toPreviewMarkdown', () => {
  it('drops frontmatter and turns links and tags into cairn: links', () => {
    const markdown = '---\ntags: [x]\n---\nSee [[My Note]], [[Doc#Setup]], [[Doc|the *doc*]] #todo';
    expect(toPreviewMarkdown(markdown)).toBe(
      'See [My Note](cairn:note/My%20Note), [Doc > Setup](cairn:note/Doc), ' +
        '[the \\*doc\\*](cairn:note/Doc) [#todo](cairn:tag/todo)',
    );
  });

  it('leaves code alone', () => {
    const markdown = '```\n[[Code]] #code\n```\n`[[inline]]`';
    expect(toPreviewMarkdown(markdown)).toBe(markdown);
  });

  it('round-trips through parsePreviewHref', () => {
    expect(parsePreviewHref('cairn:note/My%20Note')).toEqual({ kind: 'note', title: 'My Note' });
    expect(parsePreviewHref('cairn:tag/project%2Fcairn')).toEqual({
      kind: 'tag',
      tag: 'project/cairn',
    });
    expect(parsePreviewHref('https://example.com')).toBeNull();
    expect(parsePreviewHref('cairn:note/%E0%A4%A')).toBeNull();
  });
});

describe('noteTitleKey', () => {
  it('ignores case, surrounding spaces and Unicode normalization', () => {
    expect(noteTitleKey('  Café ')).toBe(noteTitleKey('café'));
  });
});
