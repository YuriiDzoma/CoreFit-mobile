# Architecture Decisions

Lightweight decision log for the choices that shape CoreFit Mobile's foundation. Each entry is Context (the problem), Decision (what we chose), Consequences (what that implies going forward).

## Expo Router

**Context:** Need a routing solution for a universal (iOS/Android/web) Expo app that scales past a handful of screens without hand-wired navigation config.

**Decision:** File-based routing via `expo-router`, with routes under `src/app` and `experiments.typedRoutes` enabled in `app.config.ts`.

**Consequences:** New screens are added by creating files, not by registering them in a navigator config. Typed routes catch invalid `href`s at compile time. Route groups and layouts (`_layout.tsx`) are the mechanism for shared chrome (tabs, headers).

## Supabase

**Context:** Need auth, a relational database, and file storage without standing up and operating custom backend infrastructure.

**Decision:** Supabase as the backend — Postgres database, built-in auth, storage, and row-level security (RLS) for authorization. Considered Firebase briefly; Supabase was chosen for SQL/Postgres (easier relational modeling for workout/progress data) and a first-class TypeScript client.

**Consequences:** Client code talks to Supabase directly from the app via its JS client (no custom API server layer to start). Authorization logic lives in Postgres RLS policies, not application code. `EXPO_PUBLIC_SUPABASE_URL` and `EXPO_PUBLIC_SUPABASE_ANON_KEY` (see `.env.example`) are the only credentials the client needs — the anon key is safe to embed in the bundle by design.

## TanStack Query

**Context:** Screens will need to fetch, cache, and revalidate data from Supabase without each screen re-implementing loading/error/refetch state.

**Decision:** `@tanstack/react-query` as the server-state layer, wrapping Supabase calls in query/mutation hooks.

**Consequences:** Server data is cached and deduplicated across screens automatically. Loading/error UI follows one consistent pattern. Server state (from Supabase) and client state (UI-only) stay clearly separated — server state does not belong in Zustand.

## Zustand

**Context:** Need a place for client-only/UI state (e.g. active tab, in-progress form drafts, ephemeral UI flags) that doesn't belong in the server-state cache.

**Decision:** Zustand for client state — minimal API, no boilerplate, no providers required.

**Consequences:** State that mirrors the backend goes through TanStack Query, not Zustand. Zustand stores stay small and UI-focused; if a store starts caching server data, that's a sign it should be a query instead.

## React Hook Form

**Context:** Auth, onboarding, and profile screens need validated forms with reasonable performance (no full-tree re-render per keystroke).

**Decision:** `react-hook-form` for form state and validation wiring, paired with Zod resolvers.

**Consequences:** Form validation schemas are defined once in Zod and reused for the resolver — no separate hand-written validation logic per form.

## Zod

**Context:** Validation is needed in three places: parsing environment variables, validating form input, and validating/typing Supabase responses. Using a different tool for each would triplicate effort.

**Decision:** Zod as the single schema/validation library across all three use cases.

**Consequences:** One schema can, in principle, back both a form's validation and the shape of the data it submits to Supabase. Environment variable parsing (when added) uses Zod schemas rather than manual `if` checks.

## Password recovery as a dedicated auth state

**Context:** Supabase's password-recovery flow (`resetPasswordForEmail` → emailed link → `exchangeCodeForSession`) establishes a real session, indistinguishable from a normal login by session shape alone. The app's root navigator gates access to `(app)` purely on session presence, so without further care a recovery session would satisfy that guard and drop the user straight into the main app before they've actually changed their password.

**Decision:** Track password recovery as its own `AuthStatus` value (`passwordRecovery`), set only in response to Supabase's authoritative `PASSWORD_RECOVERY` auth event — never inferred from session presence alone, and never treated as equivalent to `authenticated`. `reset-password` is gated behind `Stack.Protected guard={status === 'passwordRecovery'}`, structurally separate from the `authenticated` guard on `(app)`, so a recovery session can reach only the reset-password screen and nothing else in the app. After a successful `updateUser({ password })`, the recovery session is explicitly ended (`signOut()`) and the user is redirected to `/login` (with a success flag) rather than into `(app)` — password reset always ends in an explicit, intentional sign-in with the new credential, not an implicit continuation of the recovery session.

**Consequences:** The auth state machine stays clean and closed: `passwordRecovery` is only ever entered via the real Supabase event and only ever exited via sign-out, so it can't be spoofed by a malformed deep link or silently upgraded to a full session. This does mean password reset costs the user one extra sign-in step compared to auto-login after reset — accepted as the safer default. The platform-specific parts of the flow (deep-link URL construction, reading `code`/`type` from the callback route) are isolated in `src/lib/supabase/auth.ts` and `auth-callback.tsx`; the state machine itself, the Supabase call shapes (`resetPasswordForEmail`, `updateUser`), and the redirect-to-login behavior are platform-agnostic and intended to carry over to the future web implementation with only those isolated parts needing a web-specific rewrite (browser redirect URL instead of a deep link, `detectSessionInUrl`-based session capture instead of manual code exchange).

## StyleSheet + theme tokens

**Context:** Need a consistent visual language (colors, spacing) across components without committing early to a heavier styling library.

**Decision:** Keep React Native's built-in `StyleSheet` API, backed by the existing token system in `src/constants/theme.ts` (`Colors`, `Spacing`, `Fonts`) and the `useTheme` hook. `theme.ts` already documents NativeWind, Tamagui, and Unistyles as known alternatives.

**Consequences:** Styling stays dependency-free and close to React Native primitives. This is deliberately deferred, not rejected outright — revisit only if the current approach causes real friction as the component set grows (see `docs/roadmap.md`).
