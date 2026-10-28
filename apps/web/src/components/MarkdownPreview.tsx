import { parsePreviewHref, toPreviewMarkdown } from '@cairn/core';
import Link from 'next/link';
import { useMemo } from 'react';
import ReactMarkdown, { type Components, defaultUrlTransform } from 'react-markdown';
import remarkGfm from 'remark-gfm';

interface MarkdownPreviewProps {
  markdown: string;
  /** The id of the note a [[link]] points to, or `null` if there's no such note yet. */
  resolveLink: (title: string) => string | null;
  /** Clicked a [[link]] to a note that doesn't exist yet. */
  onCreateNote: (title: string) => void;
}

// Keep our own cairn: links (wikilinks and tags). Everything else gets react-markdown's usual
// check, which drops javascript: and other unsafe URLs.
const urlTransform = (url: string) => (parsePreviewHref(url) ? url : defaultUrlTransform(url));

/**
 * Renders Markdown (with GitHub tables, task lists, strikethrough), [[wikilinks]] and #tags.
 * Raw HTML in a note is shown as text, not run, so a note can't inject scripts.
 */
export function MarkdownPreview({ markdown, resolveLink, onCreateNote }: MarkdownPreviewProps) {
  const source = useMemo(() => toPreviewMarkdown(markdown), [markdown]);

  const components: Components = {
    a: ({ href, children }) => {
      const target = parsePreviewHref(href);
      if (!target) {
        return (
          <a href={href} target="_blank" rel="noopener noreferrer">
            {children}
          </a>
        );
      }
      if (target.kind === 'tag') {
        return (
          <Link
            href={`/notes?tag=${encodeURIComponent(target.tag)}`}
            className="rounded bg-moss-50 px-1 font-medium text-moss-700 no-underline"
          >
            {children}
          </Link>
        );
      }
      const id = resolveLink(target.title);
      if (id) {
        return (
          <Link href={`/notes/${id}`} className="text-moss-700">
            {children}
          </Link>
        );
      }
      // Like Obsidian: a link to a missing note is dimmed, and clicking it creates the note.
      return (
        <button
          type="button"
          onClick={() => onCreateNote(target.title)}
          title={`Create "${target.title}"`}
          className="cursor-pointer text-stone-400 underline decoration-dashed underline-offset-2"
        >
          {children}
        </button>
      );
    },
  };

  return (
    <article className="prose prose-stone max-w-none">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        urlTransform={urlTransform}
        components={components}
      >
        {source}
      </ReactMarkdown>
    </article>
  );
}
