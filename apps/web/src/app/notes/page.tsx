'use client';

import { Button, NoteList, TagBar, useCreateNote, useNotesList, useTags } from '@cairn/ui';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

export default function NotesPage() {
  // useSearchParams needs a Suspense boundary, or Next.js can't prerender the page.
  return (
    <Suspense fallback={<p className="px-4 py-4 text-stone-500">Loading…</p>}>
      <NotesIndex />
    </Suspense>
  );
}

function NotesIndex() {
  const router = useRouter();
  // The tag filter lives in the URL (/notes?tag=todo), so it survives reloads and #tag links.
  const tag = useSearchParams().get('tag')?.toLowerCase() || undefined;
  const { notes, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotesList(tag);
  const tags = useTags();
  const createNote = useCreateNote();

  function newNote() {
    createNote.mutate({}, { onSuccess: (note) => router.push(`/notes/${note.id}`) });
  }

  return (
    <div className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col">
      <div className="flex items-center justify-between px-4 py-4">
        <h1 className="text-2xl font-bold text-stone-900">Notes</h1>
        <Button title="New note" onPress={newNote} loading={createNote.isPending} />
      </div>
      {createNote.error && (
        <p className="px-4 pb-2 text-sm text-red-600">{createNote.error.message}</p>
      )}

      <TagBar
        tags={tags.data?.tags ?? []}
        selected={tag}
        onSelect={(next) =>
          router.replace(next ? `/notes?tag=${encodeURIComponent(next)}` : '/notes')
        }
      />

      {isPending ? (
        <p className="px-4 text-stone-500">Loading…</p>
      ) : error ? (
        <p className="px-4 text-red-600">Couldn't load your notes: {error.message}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <NoteList
            notes={notes}
            tag={tag}
            onPressNote={(id) => router.push(`/notes/${id}`)}
            onEndReached={() => {
              if (hasNextPage && !isFetchingNextPage) void fetchNextPage();
            }}
            loadingMore={isFetchingNextPage}
          />
        </div>
      )}
    </div>
  );
}
