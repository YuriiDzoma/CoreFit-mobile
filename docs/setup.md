# Setup

## Prerequisites

- Node.js and npm
- A Supabase project (free tier is fine) — for its URL and anon key

## Getting started

1. Install dependencies

   ```bash
   npm install
   ```

2. Configure environment variables

   ```bash
   cp .env.example .env
   ```

   Fill in `.env` with your Supabase project's values:
   - `EXPO_PUBLIC_SUPABASE_URL` — from Supabase project settings → API
   - `EXPO_PUBLIC_SUPABASE_ANON_KEY` — the `anon`/`public` key from the same page

   `EXPO_PUBLIC_`-prefixed variables are loaded automatically by Expo from `.env` — no extra setup needed. `.env` is git-ignored; only `.env.example` is committed.

3. Start the app

   ```bash
   npm start
   ```

   Then choose a target from the Expo CLI output (development build, Android emulator, iOS simulator, or Expo Go).

   Platform-specific shortcuts: `npm run android`, `npm run ios`, `npm run web`.

## EAS builds

Build profiles (`development`, `preview`, `production`) are defined in `eas.json`. Before the first build:

```bash
eas login
eas init
```

`eas init` links this project to an EAS account and writes a `projectId` into the resolved Expo config (`extra.eas.projectId`) — this hasn't been done yet, so no `projectId` exists in the repo currently.

## Linting

```bash
npm run lint
```

Currently runs `expo lint`, which has no ESLint config installed yet — see `docs/roadmap.md` (P0).
