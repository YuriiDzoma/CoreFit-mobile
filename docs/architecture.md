# Architecture

## Today

- **Routing:** `expo-router`, file-based, routes under `src/app`. `src/app/_layout.tsx` wraps the app in `ThemeProvider` and renders `AppTabs`. Typed routes are on (`experiments.typedRoutes` in `app.config.ts`).
- **Components:** `src/components` holds shared UI (`themed-text.tsx`, `themed-view.tsx`, `app-tabs.tsx`, etc.) plus `src/components/ui` for lower-level primitives (`collapsible.tsx`). Platform-specific variants use the `.web.tsx` suffix (`animated-icon.web.tsx`, `app-tabs.web.tsx`) — Metro resolves the right file per platform automatically.
- **Theming:** `src/constants/theme.ts` defines `Colors` (light/dark), `Spacing`, and `Fonts` as the single source of truth for design tokens. `src/hooks/use-theme.ts` resolves the active color scheme (with a web-specific variant in `use-color-scheme.web.ts`) into the current `Colors` set. Components style themselves with `StyleSheet.create` plus these tokens — see the styling decision in `docs/decisions.md`.
- **Config:** `app.config.ts` is the single source of Expo config (name, icons, splash, plugins, experiments) — see `docs/decisions.md` for why it replaced `app.json`. `eas.json` defines the `development`/`preview`/`production` build profiles.

## Planned, not yet implemented

These are foundation-stage decisions (see `docs/decisions.md`) that don't have code yet — nothing in `src/` has changed as part of this sprint:

- **Data layer:** TanStack Query for Supabase-backed server state (queries/mutations), separate from Zustand for client-only UI state.
- **Networking:** A Supabase client instance reading `EXPO_PUBLIC_SUPABASE_URL` / `EXPO_PUBLIC_SUPABASE_ANON_KEY` from the environment (see `.env.example`), used as the TanStack Query fetcher.
- **Auth:** Supabase Auth, with session tokens persisted via `expo-secure-store` (not yet installed).
- **Forms:** React Hook Form + Zod resolvers for auth/onboarding/profile screens.

Refer to `docs/roadmap.md` for the sequencing of when each of these lands.
