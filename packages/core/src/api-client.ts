import type { CreateNoteInput, Note, NotesPage, UpdateNoteInput } from './notes';

export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly body?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

export interface ApiClientOptions {
  /**
   * Where the API lives. Empty string on web (Next.js proxies `/api` to the API server, so
   * requests are same-origin). A full URL like `http://192.168.1.5:4000` on mobile.
   */
  baseUrl: string;
  /** Extra headers for every request. Mobile uses this to send the session cookie. */
  getHeaders?: () => Record<string, string> | Promise<Record<string, string>>;
  /** `fetch` credentials mode. Mobile sets the cookie itself, so it passes `'omit'`. */
  credentials?: 'omit' | 'same-origin' | 'include';
}

/** Typed wrapper around the Cairn REST API. Works anywhere `fetch` exists. */
export function createApiClient({
  baseUrl,
  getHeaders,
  credentials = 'same-origin',
}: ApiClientOptions) {
  async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
    const headers: Record<string, string> = { ...(await getHeaders?.()) };
    if (body !== undefined) headers['content-type'] = 'application/json';

    const res = await fetch(`${baseUrl}/api${path}`, {
      method,
      headers,
      credentials,
      body: body === undefined ? undefined : JSON.stringify(body),
    });

    if (res.status === 204) return undefined as T;
    const data: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      const message =
        data && typeof data === 'object' && 'message' in data && typeof data.message === 'string'
          ? data.message
          : `Request failed with status ${res.status}`;
      throw new ApiError(res.status, message, data);
    }
    return data as T;
  }

  return {
    notes: {
      list: ({ cursor, limit }: { cursor?: string | null; limit?: number } = {}) => {
        const query = new URLSearchParams();
        if (cursor) query.set('cursor', cursor);
        if (limit) query.set('limit', String(limit));
        const qs = query.toString();
        return request<NotesPage>('GET', `/notes${qs ? `?${qs}` : ''}`);
      },
      get: (id: string) => request<Note>('GET', `/notes/${id}`),
      create: (input: CreateNoteInput = {}) => request<Note>('POST', '/notes', input),
      update: (id: string, input: UpdateNoteInput) => request<Note>('PATCH', `/notes/${id}`, input),
      remove: (id: string) => request<void>('DELETE', `/notes/${id}`),
    },
  };
}

export type ApiClient = ReturnType<typeof createApiClient>;
