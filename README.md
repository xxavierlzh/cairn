# Cairn

AI-powered notes for web and mobile: source-grounded chat with citations, plus a Markdown editor that exports a real Obsidian vault.

Status: **Phase 1** (monorepo setup). See [CHANGELOG.md](CHANGELOG.md).

## Repo layout

```
apps/
  web/        Next.js 16 (App Router) + react-native-web
  mobile/     Expo SDK 58 (Expo Router)
packages/
  core/       Platform-agnostic TypeScript (types, parsers). No React, no Node APIs.
  ui/         Shared React Native components, styled with NativeWind
  typescript-config/  Shared tsconfig bases
```

Planned: `apps/api` (Fastify) and `packages/export` (Obsidian vault builder).

## Prerequisites

- Node.js 22.12+
- pnpm 12: `corepack enable` picks up the version pinned in `package.json`
- For mobile: the [Expo Go](https://expo.dev/go) app on your phone (same Wi-Fi as your computer)

## Getting started

```bash
pnpm install
pnpm dev       # web app on http://localhost:3000
pnpm mobile    # Expo dev server; scan the QR code with Expo Go (Android) or the Camera app (iOS)
```

## Commands

| Command          | What it does                                |
| ---------------- | ------------------------------------------- |
| `pnpm dev`       | Runs every app's `dev` task (currently web) |
| `pnpm mobile`    | Starts the Expo dev server                  |
| `pnpm build`     | Production builds via Turborepo             |
| `pnpm typecheck` | `tsc` across all packages                   |
| `pnpm lint`      | Biome lint + format check                   |
| `pnpm format`    | Biome autofix                               |

## How shared UI works

`packages/ui` components use React Native primitives (`View`, `Text`) with Tailwind `className`s:

- **Mobile**: NativeWind compiles the classes to React Native styles at build time.
- **Web**: `react-native` is aliased to `react-native-web`, and Tailwind generates real CSS.

Things to know before adding UI:

- Every file in `packages/ui/src` that uses `className` needs the `/** @jsxImportSource nativewind */` pragma and `'use client'` (NativeWind doesn't support React Server Components).
- Both apps' `tailwind.config.js` scan `packages/ui/src`. Shared design tokens live in `packages/ui/tailwind-preset.js`.
- The web app builds with **webpack**, not Turbopack. React Native libraries ship `Foo.web.js` variants, and Turbopack won't resolve those inside `node_modules`.
- pnpm uses `nodeLinker: hoisted` (a flat `node_modules`) because Metro and NativeWind break on duplicate packages.
