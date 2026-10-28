# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Phase 3: Wikilinks, backlinks, tags and Obsidian vault export

#### Added

- `@cairn/core`: a parser for `[[wikilinks]]` (headings, block refs, aliases, embeds, `\|` in tables), `#tags` and YAML frontmatter. It skips code blocks and inline code, like Obsidian. Also `rewriteLinks` for renames, and `toPreviewMarkdown`, which turns links and tags into links any Markdown renderer can show.
- `@cairn/export` (new): streams notes into a `.zip` of `<title>.md` files with fflate. Each note's Markdown is kept byte for byte, and its modified time is when the note was last edited.
- `apps/api`:
  - Every save stores the note's tags and the titles it links to. Notes come back with their outgoing links resolved to note ids.
  - New routes: `GET /api/notes/:id/backlinks`, `GET /api/tags`, `GET /api/notes?tag=` (which also matches nested tags) and `GET /api/export`.
  - Export streams the zip as the client reads it, and is limited to 5 a minute.
- Web and mobile:
  - Clickable wikilinks in the preview. Links to missing notes are dimmed, and opening one creates the note.
  - `#tags` in the preview open the notes list filtered by that tag.
  - Backlinks under the preview, tag chips on the notes list, and an export button. Mobile shares the zip through the share sheet (`expo-file-system` + `expo-sharing`, both in Expo Go).

#### Changed

- Titles are unique per user, ignoring case, so links and exported filenames are never ambiguous. A taken title returns `409`, and the editor keeps saving the body while it shows the error.
- New notes are titled `Untitled`, `Untitled 1`, ..., using the lowest free number, like Obsidian.
- Renaming a note rewrites links to it in your other notes, in the same transaction as the rename.
- Titles that start or end with a dot, or that Windows reserves (`CON`, `NUL`, `COM1`, ...), are rejected.
- On startup, the API backfills tags, links and title keys for older notes and renumbers duplicate titles. It does nothing once every note has been backfilled.
- The editor waits for fresh data before you can edit. Otherwise a cached copy could undo links that a rename had just rewritten.
- External links in the web preview open in a new tab.

## Phase 2: Auth, notes CRUD and Markdown editor (merged in #2)

#### Added

- `apps/api`: Fastify 5 server with Better Auth (email + password) and a notes REST API on MongoDB. Each user only sees their own notes. Lists are paginated with a cursor, and every request is validated with zod. Includes per-IP rate limiting, security headers, and integration tests against an in-memory MongoDB replica set.
- `@cairn/core`: zod schemas for notes, shared by the API and both apps, plus a typed `fetch` API client. Titles reject characters that would break Obsidian filenames and `[[wikilinks]]`.
- `@cairn/ui`: shared `AuthForm`, `NoteList`, `Button` and `TextField` components, and TanStack Query hooks. `useNoteEditor` autosaves 0.8s after typing stops, sends saves in order, and saves any pending edit when you leave the screen.
- `apps/web`: sign-in/sign-up pages, the notes list, and a Markdown editor (CodeMirror 6) with write, split and preview layouts. `/api` is proxied to the API, so the session cookie is same-origin.
- `apps/mobile`: sign-in/sign-up, the notes list with pull-to-refresh, and a Markdown editor with a preview tab. Sessions are stored in SecureStore, and `Stack.Protected` keeps signed-out users on the auth screens.
- `docker-compose.yml`: local MongoDB (`mongodb-atlas-local`), bound to localhost only.
- CI runs the test suites and caches the MongoDB test binary.

#### Changed

- The web editor uses CodeMirror 6 instead of TipTap. Editing the Markdown source directly means what's saved is exactly what gets exported to Obsidian. WYSIWYG editors convert Markdown to their own format and back, which can rewrite frontmatter, links and spacing.

#### Removed

- The Phase 1 `HelloCairn` demo component.

## Phase 1: Monorepo setup (merged in #1)

#### Added

- pnpm workspace with Turborepo, Biome and shared `tsconfig` bases.
- `@cairn/core`: platform-agnostic constants shared by every app.
- `@cairn/ui`: `HelloCairn` component built with React Native primitives and NativeWind, plus a shared Tailwind preset (`moss` palette).
- `apps/mobile`: Expo SDK 58 app (Expo Router) rendering `HelloCairn` on iOS and Android.
- `apps/web`: Next.js 16 app rendering `HelloCairn` through react-native-web.
- GitHub Actions CI: lint, typecheck and build on every push to `main` and every PR.
