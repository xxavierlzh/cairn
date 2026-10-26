'use client';

import { Button, NoteList, useCreateNote, useNotesList } from '@cairn/ui';
import { useRouter } from 'next/navigation';

export default function NotesPage() {
  const router = useRouter();
  const { notes, isPending, error, fetchNextPage, hasNextPage, isFetchingNextPage } =
    useNotesList();
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

      {isPending ? (
        <p className="px-4 text-stone-500">Loading…</p>
      ) : error ? (
        <p className="px-4 text-red-600">Couldn't load your notes: {error.message}</p>
      ) : (
        <div className="flex min-h-0 flex-1 flex-col">
          <NoteList
            notes={notes}
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
