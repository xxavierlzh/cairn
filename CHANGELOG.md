# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/).

## [Unreleased]

### Phase 1: Monorepo setup

#### Added

- pnpm workspace with Turborepo, Biome and shared `tsconfig` bases.
- `@cairn/core`: platform-agnostic constants shared by every app.
- `@cairn/ui`: `HelloCairn` component built with React Native primitives and NativeWind, plus a shared Tailwind preset (`moss` palette).
- `apps/mobile`: Expo SDK 58 app (Expo Router) rendering `HelloCairn` on iOS and Android.
- `apps/web`: Next.js 16 app rendering `HelloCairn` through react-native-web.
- GitHub Actions CI: lint, typecheck and build on every push to `main` and every PR.
