# Cairn

AI-powered notes for web and mobile: source-grounded chat with citations, plus a Markdown editor that exports a real Obsidian vault.

Status: **Phase 2** (auth, notes CRUD, Markdown editor). See [CHANGELOG.md](CHANGELOG.md).

## Repo layout

```
apps/
  api/        Fastify API: Better Auth (email + password) and notes CRUD, on MongoDB
  web/        Next.js 16 (App Router) + react-native-web
  mobile/     Expo SDK 58 (Expo Router)
packages/
  core/       Platform-agnostic TypeScript: zod schemas, typed API client. No React, no Node APIs.
  ui/         Shared React Native components and data hooks, styled with NativeWind
  typescript-config/  Shared tsconfig bases
```

Planned: `packages/export` (Obsidian vault builder).

## How the pieces talk

```
Browser ──> Next.js :3000 ──(proxies /api/*)──> Fastify API :4000 ──> MongoDB
Phone (Expo Go) ─────────────────────────────> Fastify API :4000 ──> MongoDB
```

- **Web** only ever talks to its own origin. Next.js forwards `/api/*` to the API, so the session cookie is first-party and there's no CORS to configure.
- **Mobile** calls the API directly at `http://<your-pc-ip>:4000`, which it works out from the Expo dev server's address. The session cookie lives in SecureStore and is sent as a `Cookie` header.

## Prerequisites

- Node.js 22.12+
- pnpm 12: `corepack enable` picks up the version pinned in `package.json`
- [Docker Desktop](https://www.docker.com/products/docker-desktop/) for the local database (or a MongoDB Atlas connection string)
- For mobile: the [Expo Go](https://expo.dev/go) app on your phone, on the same Wi-Fi as your computer

## Getting started

```bash
pnpm install

# 1. Start MongoDB (a local Atlas image: replica set + Vector Search, like production)
docker compose up -d

# 2. Configure the API. Never commit .env.
cp apps/api/.env.example apps/api/.env
node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
#    Paste the output into BETTER_AUTH_SECRET in apps/api/.env

# 3. Run the API (:4000) and web app (:3000) together
pnpm dev

# 4. In another terminal: the mobile dev server. Scan the QR code with the Camera app (iOS) or Expo Go (Android)
pnpm mobile
```

Open http://localhost:3000, create an account and write a note. Sign in with the same account on your phone and you'll see it there too.

## Commands

| Command          | What it does                                    |
| ---------------- | ----------------------------------------------- |
| `pnpm dev`       | Runs the API and web app in watch mode          |
| `pnpm mobile`    | Starts the Expo dev server                      |
| `pnpm test`      | Unit tests (core) and API integration tests     |
| `pnpm build`     | Production builds via Turborepo                 |
| `pnpm typecheck` | `tsc` across all packages                       |
| `pnpm lint`      | Biome lint + format check                       |
| `pnpm format`    | Biome autofix                                   |

API tests start a throwaway in-memory MongoDB, so they don't need Docker. The first run downloads a MongoDB binary (a few hundred MB), so it can take a few minutes.

## API

All `/api/notes` routes need a signed-in session and only ever see the caller's own notes. Another user's note returns `404`, never `403`, so ids can't be probed.

| Method   | Path                                 | Body / query                        |
| -------- | ------------------------------------ | ----------------------------------- |
| `POST`   | `/api/auth/sign-up/email`            | `{ name, email, password }`         |
| `POST`   | `/api/auth/sign-in/email`            | `{ email, password }`               |
| `GET`    | `/api/notes`                         | `?limit=20&cursor=...` (newest first) |
| `POST`   | `/api/notes`                         | `{ title?, markdown? }`             |
| `GET`    | `/api/notes/:id`                     |                                     |
| `PATCH`  | `/api/notes/:id`                     | `{ title?, markdown? }`             |
| `DELETE` | `/api/notes/:id`                     |                                     |
| `GET`    | `/api/health`                        |                                     |

Request bodies are validated with the zod schemas in `packages/core`, the same ones the apps use. Titles can't contain characters Obsidian rejects in filenames or links (`\ / : * ? " < > | # ^ [ ]`), so every note can be exported later.

## How shared UI works

`packages/ui` components use React Native primitives (`View`, `Text`) with Tailwind `className`s:

- **Mobile**: NativeWind compiles the classes to React Native styles at build time.
- **Web**: `react-native` is aliased to `react-native-web`, and Tailwind generates real CSS.

The sign-in form, notes list and the autosave logic (`useNoteEditor`) are shared. The editors are per platform: CodeMirror 6 on web (the editor Obsidian uses), and a plain text input with a preview tab on mobile. Both edit the raw Markdown, which is the source of truth.

Things to know before adding UI:

- Every file in `packages/ui/src` that uses `className` needs the `/** @jsxImportSource nativewind */` pragma and `'use client'` (NativeWind doesn't support React Server Components).
- Both apps' `tailwind.config.js` scan `packages/ui/src`. Shared design tokens live in `packages/ui/tailwind-preset.js`.
- The web app builds with **webpack**, not Turbopack. React Native libraries ship `Foo.web.js` variants, and Turbopack won't resolve those inside `node_modules`.
- pnpm uses `nodeLinker: hoisted` (a flat `node_modules`) because Metro and NativeWind break on duplicate packages.

## Troubleshooting

- **Phone says it can't reach the API.** Windows Firewall must allow Node.js on private networks (it asks the first time). Campus Wi-Fi often blocks devices from talking to each other. Use your phone's hotspot, or set `EXPO_PUBLIC_API_URL` (see `apps/mobile/.env.example`).
- **`pnpm install` fails with "Access is denied".** A running dev server (usually Expo) is holding files open. Stop it and retry.
- **"Project is incompatible with this version of Expo Go".** The App Store build of Expo Go can lag behind a new Expo SDK. Update Expo Go, or wait for the store release.
