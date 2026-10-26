'use client';

import { ApiError, type CreateNoteInput, noteTitleSchema, type UpdateNoteInput } from '@cairn/core';
import {
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useEffect, useRef, useState } from 'react';
import { useApi } from './api-context';

export const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  detail: (id: string) => [...noteKeys.all, 'detail', id] as const,
};

export function createQueryClient() {
  return new QueryClient({
    defaultOptions: {
      queries: {
        staleTime: 30_000,
        // Retrying a 4xx (not found, signed out) won't help. Only retry server and network errors.
        retry: (failureCount, error) =>
          !(error instanceof ApiError && error.status < 500) && failureCount < 2,
      },
    },
  });
}

/** All of the user's notes, newest first, loaded a page at a time. */
export function useNotesList() {
  const api = useApi();
  const query = useInfiniteQuery({
    queryKey: noteKeys.lists(),
    queryFn: ({ pageParam }) => api.notes.list({ cursor: pageParam }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const notes = query.data?.pages.flatMap((page) => page.items) ?? [];
  return { ...query, notes };
}

export function useCreateNote() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: CreateNoteInput) => api.notes.create(input),
    onSuccess: (note) => {
      queryClient.setQueryData(noteKeys.detail(note.id), note);
      void queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
    },
  });
}

export type SaveStatus = 'saved' | 'unsaved' | 'saving' | 'error';

export const SAVE_STATUS_LABEL: Record<SaveStatus, string> = {
  saved: 'Saved',
  unsaved: 'Editing…',
  saving: 'Saving…',
  error: "Couldn't save. Retrying when you type.",
};

export interface NoteDraft {
  title: string;
  markdown: string;
}

const AUTOSAVE_DELAY_MS = 800;

/**
 * Loads a note and autosaves edits to it. Render the editor with `key={id}` so switching
 * notes starts with a fresh draft.
 */
export function useNoteEditor(id: string) {
  const api = useApi();
  const queryClient = useQueryClient();
  const query = useQuery({ queryKey: noteKeys.detail(id), queryFn: () => api.notes.get(id) });

  const [draft, setDraft] = useState<NoteDraft | null>(null);
  const [status, setStatus] = useState<SaveStatus>('saved');
  /** The latest edit that hasn't been sent yet. */
  const pending = useRef<UpdateNoteInput | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Copy the server version into the editable draft the first time it arrives.
  if (draft === null && query.data) {
    setDraft({ title: query.data.title, markdown: query.data.markdown });
  }

  const { mutate: save } = useMutation({
    // Mutations with the same scope run one at a time, so saves reach the server in order.
    scope: { id: `note-${id}` },
    mutationFn: (input: UpdateNoteInput) => api.notes.update(id, input),
    onSuccess: (note) => {
      queryClient.setQueryData(noteKeys.detail(id), note);
      void queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
    },
  });

  function flush() {
    clearTimeout(timer.current);
    const input = pending.current;
    if (!input) return;
    pending.current = null;
    setStatus('saving');
    save(input, {
      onSuccess: () => {
        if (!pending.current) setStatus('saved');
      },
      onError: () => {
        pending.current ??= input;
        setStatus('error');
      },
    });
  }

  function edit(patch: Partial<NoteDraft>) {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    // If the title is invalid (say, empty while retyping it), keep saving the body anyway.
    pending.current = noteTitleSchema.safeParse(next.title).success
      ? next
      : { markdown: next.markdown };
    setStatus('unsaved');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  }

  // Leaving the screen mid-debounce would drop the last edit, so send it now.
  useEffect(
    () => () => {
      clearTimeout(timer.current);
      if (pending.current) save(pending.current);
    },
    [save],
  );

  const remove = useMutation({
    mutationFn: () => api.notes.remove(id),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: noteKeys.lists() }),
  });

  const titleCheck = draft ? noteTitleSchema.safeParse(draft.title) : null;

  return {
    note: query.data,
    isLoading: query.isPending,
    error: query.error,
    draft,
    status,
    titleError: titleCheck?.success === false ? titleCheck.error.issues[0]?.message : undefined,
    setTitle: (title: string) => edit({ title }),
    setMarkdown: (markdown: string) => edit({ markdown }),
    deleteNote: async () => {
      clearTimeout(timer.current);
      pending.current = null;
      await remove.mutateAsync();
    },
    isDeleting: remove.isPending,
  };
}
