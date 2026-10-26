import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

/**
 * Renders Markdown (with GitHub tables, task lists, strikethrough). Raw HTML in a note is shown
 * as text, not run, and javascript: links are stripped, so a note can't inject scripts.
 */
export function MarkdownPreview({ markdown }: { markdown: string }) {
  return (
    <article className="prose prose-stone max-w-none">
      <ReactMarkdown remarkPlugins={[remarkGfm]}>{markdown}</ReactMarkdown>
    </article>
  );
}
