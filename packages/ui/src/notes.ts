'use client';

import {
  ApiError,
  type CreateNoteInput,
  type Note,
  noteTitleKey,
  noteTitleSchema,
  type UpdateNoteInput,
} from '@cairn/core';
import {
  QueryClient,
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
} from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useApi } from './api-context';

export const noteKeys = {
  all: ['notes'] as const,
  lists: () => [...noteKeys.all, 'list'] as const,
  list: (tag: string | undefined) => [...noteKeys.lists(), { tag: tag ?? null }] as const,
  details: () => [...noteKeys.all, 'detail'] as const,
  detail: (id: string) => [...noteKeys.details(), id] as const,
  backlinks: (id?: string) => [...noteKeys.all, 'backlinks', ...(id ? [id] : [])] as const,
  tags: () => [...noteKeys.all, 'tags'] as const,
};

/** After any note changes: lists and tag counts may be out of date. */
function invalidateAfterSave(queryClient: QueryClient) {
  void queryClient.invalidateQueries({ queryKey: noteKeys.lists() });
  void queryClient.invalidateQueries({ queryKey: noteKeys.tags() });
  // Other notes' backlinks may have changed too. Refetch them when they're next shown.
  void queryClient.invalidateQueries({ queryKey: noteKeys.backlinks(), refetchType: 'none' });
}

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

/** The user's notes, newest first, loaded a page at a time. Pass a tag to filter by it. */
export function useNotesList(tag?: string) {
  const api = useApi();
  const query = useInfiniteQuery({
    queryKey: noteKeys.list(tag),
    queryFn: ({ pageParam }) => api.notes.list({ cursor: pageParam, tag }),
    initialPageParam: null as string | null,
    getNextPageParam: (lastPage) => lastPage.nextCursor,
  });
  const notes = query.data?.pages.flatMap((page) => page.items) ?? [];
  return { ...query, notes };
}

/** Every tag in use, most used first. */
export function useTags() {
  const api = useApi();
  return useQuery({ queryKey: noteKeys.tags(), queryFn: () => api.tags.list() });
}

/** Notes that link to this one. */
export function useBacklinks(id: string) {
  const api = useApi();
  return useQuery({ queryKey: noteKeys.backlinks(id), queryFn: () => api.notes.backlinks(id) });
}

export function useCreateNote() {
  const api = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (input?: CreateNoteInput) => api.notes.create(input),
    onSuccess: (note) => {
      queryClient.setQueryData(noteKeys.detail(note.id), note);
      invalidateAfterSave(queryClient);
    },
  });
}

/**
 * Following a [[link]], as in Obsidian: opens the note, or creates it first if no note has
 * that title yet. `resolve` comes from `useNoteEditor`; `open` navigates to a note id.
 */
export function useFollowLink(
  resolve: (title: string) => string | null,
  open: (id: string) => void,
) {
  const { mutate: create, isPending, error } = useCreateNote();
  const follow = useCallback(
    (title: string) => {
      const id = resolve(title);
      if (id) open(id);
      else create({ title }, { onSuccess: (note) => open(note.id) });
    },
    [resolve, open, create],
  );
  return { follow, isCreating: isPending, error };
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
  /** A title the server said another note already has. Until it changes, only the body saves. */
  const [takenTitle, setTakenTitle] = useState<string | null>(null);
  /** The latest edit that hasn't been sent yet. */
  const pending = useRef<UpdateNoteInput | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout>>(undefined);

  // Copy the server version into the editable draft once it's up to date. A cached copy can
  // be stale (renaming another note may have rewritten links in this one), and saving edits
  // made on top of it would undo that.
  if (draft === null && query.data && !query.isFetching) {
    setDraft({ title: query.data.title, markdown: query.data.markdown });
  }

  const isTaken = (title: string) =>
    takenTitle !== null && noteTitleKey(title) === noteTitleKey(takenTitle);

  const { mutate: save } = useMutation({
    // Mutations with the same scope run one at a time, so saves reach the server in order.
    scope: { id: `note-${id}` },
    mutationFn: (input: UpdateNoteInput) => api.notes.update(id, input),
    onSuccess: (note) => {
      const before = queryClient.getQueryData<Note>(noteKeys.detail(id));
      queryClient.setQueryData(noteKeys.detail(id), note);
      invalidateAfterSave(queryClient);
      // A rename rewrites links in other notes, so cached copies of them are now out of date.
      if (before && before.title !== note.title) {
        void queryClient.invalidateQueries({ queryKey: noteKeys.details(), refetchType: 'none' });
      }
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
      onError: (error) => {
        if (error instanceof ApiError && error.status === 409 && input.title !== undefined) {
          // Title taken: show that next to the title, and save the body without it.
          setTakenTitle(input.title);
          if (input.markdown !== undefined) pending.current ??= { markdown: input.markdown };
          flush();
          return;
        }
        pending.current ??= input;
        setStatus('error');
      },
    });
  }

  function edit(patch: Partial<NoteDraft>) {
    if (!draft) return;
    const next = { ...draft, ...patch };
    setDraft(next);
    // If the title can't be saved (empty while retyping it, or taken), save the body anyway.
    const titleOk = noteTitleSchema.safeParse(next.title).success && !isTaken(next.title);
    pending.current = titleOk ? next : { markdown: next.markdown };
    setStatus('unsaved');
    clearTimeout(timer.current);
    timer.current = setTimeout(flush, AUTOSAVE_DELAY_MS);
  }

  // Note ids by title key, for the links in the last saved version of this note.
  const savedLinks = query.data?.links;
  const linkIds = useMemo(() => {
    const ids = new Map<string, string>();
    for (const link of savedLinks ?? []) {
      if (link.noteId) ids.set(noteTitleKey(link.target), link.noteId);
    }
    return ids;
  }, [savedLinks]);
  // Stable until the links change, so previews only re-render when a link resolves.
  const resolveLink = useCallback(
    (title: string) => linkIds.get(noteTitleKey(title)) ?? null,
    [linkIds],
  );

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
    onSuccess: () => invalidateAfterSave(queryClient),
  });

  const titleCheck = draft ? noteTitleSchema.safeParse(draft.title) : null;
  const titleError =
    titleCheck?.success === false
      ? titleCheck.error.issues[0]?.message
      : draft && isTaken(draft.title)
        ? `You already have a note called "${draft.title.trim()}"`
        : undefined;

  return {
    note: query.data,
    isLoading: draft === null && !query.error,
    error: query.error,
    draft,
    status,
    titleError,
    /** The id of the note a [[link]] points to, or `null` if it doesn't exist (yet). */
    resolveLink,
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
