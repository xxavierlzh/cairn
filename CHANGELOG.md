# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Phase 2: Auth, notes CRUD and Markdown editor

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
