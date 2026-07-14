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

## Profile data layer (Foundation)

**Context:** The app needs a typed, validated way to read and update the `profiles` table before any profile UI is built. The `profiles` schema isn't checked into either this repo or the web repo as migrations/DDL — the only authoritative source is the live Supabase project. `profiles` is also the first custom (non-auth) table the mobile app talks to, so this is the first real decision point for how table access should be structured, ahead of TanStack Query landing.

**Decision:** `src/lib/supabase/profile.ts` is the sole place that touches `supabase.from('profiles')`, mirroring `src/lib/supabase/auth.ts`'s existing convention exactly — no separate repository/service split, one file, plain Promise-based functions (`getProfileById`, `updateProfileById`). The `profiles` schema is defined as a Zod object matching the live database (columns, types, and nullability confirmed directly against the Supabase project via `supabase db query`, not inferred from either app's client code), and every Supabase response is parsed through it before being returned. `ProfileUpdate` is scoped to only the columns that are actually meant to be user-editable (`username`, `avatar_url`, `language`, `dark`) — `email` and `is_trainer` are excluded even though the table's RLS `UPDATE` policy doesn't itself restrict them, because neither is meant to be changed this way (`email` belongs to the auth flow; `is_trainer` is backend/admin-managed).

No `useProfile` hook or any client-side cache/store is introduced yet — this layer is deliberately Promise-only. Hooks and caching are deferred until TanStack Query is introduced (see above), once there are enough server-state features to justify it; adding a throwaway loading hook now would just be removed and replaced later.

**Consequences:** Any future table beyond `profiles` should default to this same single-file convention (schema + types + thin functions, colocated) unless it grows enough distinct concerns to justify splitting. When TanStack Query lands, `profile.ts`'s functions become the query/mutation functions passed into hooks — nothing about this layer's shape needs to change, only a hook layer gets added on top. Because RLS on `profiles` allows public `SELECT` access (including unauthenticated reads, and including `email`), callers of `getProfileById` must not assume the requester is viewing their own data — this file intentionally does not special-case "own profile" fetching.

## Exercise data layer and client-side filtering

**Context:** The web app's exercise "wiki" (`exercises` + `muscle_groups` tables, confirmed live: 61 exercises, 7 muscle groups, RLS disabled on both) issues a fresh Supabase query every time the user taps a muscle-group filter tab, plus a separate round-trip to resolve the tapped tab's hardcoded English name to a `muscle_group_id` before it can even run that query. With only 61 rows total, the entire table is cheap to hold in memory at once, and mobile's first exercise screen (`src/app/(app)/explore.tsx`) needed a filtering approach to decide on before this could be built at all.

**Decision:** `src/lib/supabase/exercises.ts` fetches the full `exercises` and `muscle_groups` tables once, unfiltered (`getExercises()` takes no parameters), mirroring `profile.ts`'s single-file convention and colocating the raw Zod schema/types with a `localizeExercise` mapping function in the same file rather than a separate module. Muscle-group filtering (`selectedMuscleGroup: string | null`, where `null` means "All") and the eventual name/description text search are both applied client-side, in-memory, in the screen itself — not as Supabase query parameters, and "All" is never written to or read from the database as a real `muscle_groups` row, it's purely a UI-level `null`. `ExerciseRow` (the raw per-language DB shape) and `LocalizedExercise` (the UI-facing, single-language-resolved shape produced by `localizeExercise`) are kept as two distinct types on purpose, even though only the `'en'` locale is used anywhere today — this is the one seam where real i18n would plug in later without changing the data layer or the fetch functions.

**Consequences:** Selecting a filter tab is instant and offline-safe (no network dependency once the initial fetch completes), and adding a text-search box later is free — it's just another client-side predicate over the same in-memory list, no new query shape needed. This approach only works because the dataset is small (tens of rows, not thousands); it should be revisited (server-side filtering, pagination) if the exercise catalog grows enough that fetching it whole becomes expensive — not applied preemptively while the current numbers make it unnecessary. Exercise cards in the list are already `Pressable` (initially with a placeholder handler, now wired to the detail screen — see below); video (`video_url`) is deliberately not rendered or fetched-for-display anywhere yet — it's carried through `ExerciseRow`/`LocalizedExercise` for completeness but has no consumer until its video-embedding approach (likely `react-native-webview`, not yet added) is built.

## Exercise detail screen and nested Stack inside a native tab

**Context:** `explore` (one of three `NativeTabs` — `expo-router/unstable-native-tabs`, the experimental native-tab-bar API) was a flat file with no push navigation. `NativeTabs` has no JS mock header the way `Tabs` does, so there was no built-in way to push a detail screen or show a back affordance within that tab without extra structure. Separately, `getExerciseById`'s `.single()` throws Supabase's generic `PGRST116` error on a missing row, and the exercise `type` column, while currently constrained by a DB `CHECK` to `'compound'`/`'isolation'`, isn't guaranteed to stay that way from the client's perspective.

**Decision:** `explore.tsx` became `explore/` with a nested `Stack` (`_layout.tsx`, `headerShown: false` to match every other `Stack` in this app) wrapping `index.tsx` (the list, unchanged aside from `handleExercisePress` now calling `router.push`) and `[id].tsx` (new). This is Expo's documented pattern for `NativeTabs` when a tab needs push navigation. The detail screen keeps the app's existing manual-back-link convention (`<Link href="/explore">`, same shape as "Back to sign in" in the auth screens) rather than turning on a native header, for visual consistency with the rest of the app rather than introducing native header chrome in one isolated place. `getExerciseById`'s `.single()` `PGRST116` error is caught specifically and mapped to a distinct not-found state, separate from generic errors — web's equivalent page has no such handling at all. `exerciseRowSchema.type` was loosened from a strict Zod enum to a plain nullable string, and a local `formatExerciseType` in `[id].tsx` maps known values to labels with an explicit default case for anything else — an enum at the schema layer would make the _entire_ fetch throw on an unexpected value, which is the opposite of the graceful handling wanted for that field.

**Consequences:** Any future tab needing push navigation (e.g. a training/programs tab) should follow the same nested-`Stack`-with-`headerShown: false` shape rather than reaching for a native header by default. The detail screen independently re-fetches by id rather than reusing the list's in-memory data (matching web's own behavior) — a deliberate, accepted redundancy at this data size (61 rows), not an oversight; revisit only if a cache layer (TanStack Query) is introduced for other reasons. React Query itself remains deliberately deferred — this is now the third server-state feature (profiles, exercise list, exercise detail) without one, a conscious choice to keep re-evaluating rather than a default.

## Exercise video via YouTube embed

**Context:** `exercises.video_url` is always a YouTube URL, but not a uniform shape — checked live: 57/61 rows are `watch?v={id}`, 4/61 are `shorts/{id}`. Web's detail page embeds video with `data.video.replace("watch?v=", "embed/")`, which does nothing on the 4 `shorts/` rows, leaving a non-embeddable URL as the iframe `src` — a real bug in web, confirmed against actual data, not a hypothetical. `expo-video` can't play YouTube URLs at all (no direct file URL YouTube exposes publicly), so an embedded web view is the only viable approach on mobile too, same underlying reason web uses an iframe instead of `<video>`.

**Decision:** `src/lib/youtube-url.ts` exports `getYouTubeEmbedUrl(url): string | null`, using the `URL` API (hostname, pathname, `searchParams`) rather than a single regex — each supported shape (`watch?v=`, `youtu.be/`, `shorts/`, and already-`embed/`-form URLs) is parsed structurally and always rebuilt into a canonical `https://www.youtube.com/embed/{id}`, fixing the `shorts/` case rather than porting web's bug. `null` in, or anything unparseable/unsupported, returns `null` — no partial/broken URLs ever reach the player. `src/components/youtube-embed.tsx` (native, `react-native-webview`) and `.web.tsx` (a plain `<iframe>`, matching the existing platform-split convention used by `app-tabs.web.tsx`/`animated-icon.web.tsx`) both take only `{ url, title }` — all normalization and the "should anything render" decision stay inside the component, so the detail screen's call site never has to know about embed URLs or YouTube's URL shapes at all. `react-native-webview` needed no config plugin; since this project uses a custom dev client (not bare Expo Go), installing it requires a native rebuild before it's testable.

**Consequences:** Any other embedded third-party player this app adds later (unlikely soon, but the shape is now established) should follow the same self-contained-component pattern — normalization logic lives with the embed, never leaks into call sites. `react-native-webview` has no web-platform support itself, which is exactly why the `.web.tsx` split exists rather than trying to make one component branch internally on `Platform.OS`. No autoplay, no play-state tracking — matches web's actual behavior, not an arbitrary restriction.

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
