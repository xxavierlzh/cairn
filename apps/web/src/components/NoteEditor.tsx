'use client';

import { ApiError } from '@cairn/core';
import { SAVE_STATUS_LABEL, useNoteEditor } from '@cairn/ui';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useDeferredValue, useState } from 'react';
import { MarkdownEditor } from './MarkdownEditor';
import { MarkdownPreview } from './MarkdownPreview';

type Layout = 'write' | 'split' | 'preview';
const LAYOUTS: Layout[] = ['write', 'split', 'preview'];

export function NoteEditor({ id }: { id: string }) {
  const router = useRouter();
  const editor = useNoteEditor(id);
  const [layout, setLayout] = useState<Layout>('split');
  // Re-rendering the preview on every keystroke can lag on long notes. A deferred value lets
  // React keep typing responsive and catch the preview up in the background.
  const previewMarkdown = useDeferredValue(editor.draft?.markdown ?? '');

  if (editor.isLoading) {
    return <p className="p-6 text-stone-500">Loading…</p>;
  }

  if (editor.error || !editor.draft) {
    const missing = editor.error instanceof ApiError && editor.error.status === 404;
    return (
      <div className="space-y-2 p-6">
        <p className="text-red-600">
          {missing ? "This note doesn't exist or was deleted." : "Couldn't load this note."}
        </p>
        <Link href="/notes" className="text-sm font-medium text-moss-700">
          ← Back to notes
        </Link>
      </div>
    );
  }

  async function handleDelete() {
    if (!window.confirm("Delete this note? This can't be undone.")) return;
    try {
      await editor.deleteNote();
      router.replace('/notes');
    } catch {
      window.alert("Couldn't delete the note. Please try again.");
    }
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <div className="flex flex-wrap items-center gap-3 border-b border-stone-200 px-4 py-2">
        <Link href="/notes" className="text-sm text-stone-600 hover:text-stone-900">
          ← Notes
        </Link>
        <span className="text-sm text-stone-500" aria-live="polite">
          {SAVE_STATUS_LABEL[editor.status]}
        </span>
        <div className="ml-auto flex gap-1 rounded-lg bg-stone-100 p-1 text-sm">
          {LAYOUTS.map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={layout === option}
              onClick={() => setLayout(option)}
              className={`rounded-md px-3 py-1 capitalize ${layout === option ? 'bg-white font-medium shadow-sm' : 'text-stone-600'}`}
            >
              {option}
            </button>
          ))}
        </div>
        <button
          type="button"
          onClick={handleDelete}
          disabled={editor.isDeleting}
          className="rounded-lg px-3 py-1.5 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-50"
        >
          Delete
        </button>
      </div>

      <div className="px-6 pt-4">
        <input
          value={editor.draft.title}
          onChange={(event) => editor.setTitle(event.target.value)}
          aria-label="Title"
          placeholder="Untitled"
          className="w-full text-3xl font-bold text-stone-900 outline-none"
        />
        {editor.titleError && <p className="mt-1 text-sm text-red-600">{editor.titleError}</p>}
      </div>

      <div className="flex min-h-0 flex-1">
        {layout !== 'preview' && (
          <div
            className={`min-h-0 overflow-auto ${layout === 'split' ? 'w-1/2 border-r border-stone-200' : 'w-full'}`}
          >
            <MarkdownEditor value={editor.draft.markdown} onChange={editor.setMarkdown} />
          </div>
        )}
        {layout !== 'write' && (
          <div
            className={`min-h-0 overflow-auto px-6 py-4 ${layout === 'split' ? 'w-1/2' : 'w-full'}`}
          >
            <MarkdownPreview markdown={previewMarkdown} />
          </div>
        )}
      </div>
    </div>
  );
}
