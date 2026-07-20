# Roadmap

Carried forward from the initial project audit, updated now that Supabase is the confirmed backend. P0 is foundation work worth finishing before more feature screens are built. P1 lands alongside the first real features. P2 is scale-driven — revisit when its trigger condition is actually true, not on a schedule.

## P0 — Foundation

- [x] Convert `app.json` to `app.config.ts`
- [x] Add `eas.json` with `development` / `preview` / `production` profiles
- [x] Add `.env.example` for Supabase credentials
- [x] Document architecture decisions (`docs/decisions.md`)
- [ ] Install and configure ESLint + Prettier (`expo lint` currently has no config behind it)
- [ ] Stand up testing (`jest-expo` + `@testing-library/react-native`), one smoke test per existing screen
- [ ] Add CI (GitHub Actions: lint, typecheck, test on PR)
- [ ] Wire up crash reporting (Sentry or equivalent)

## P1 — Alongside the first real features

- [x] Create the Supabase client
- [ ] Add TanStack Query for server state once multiple server-state features exist (`profiles` — see `src/lib/supabase/profile.ts` — is Promise-only for now, deliberately deferred rather than adding a hook/cache layer for a single table; see `docs/decisions.md`)
- [ ] Supabase Auth flow + `expo-secure-store` for session persistence
- [ ] Forms: React Hook Form + Zod for sign-up/onboarding/profile
- [ ] Turn on OTA updates (`expo-updates` + `runtimeVersion` policy) before first store submission
- [ ] Add feature-specific native capabilities as features land (camera for progress photos, HealthKit/Health Connect for activity data, notifications for reminders), each with its permission strings added at point of use

## P2 — Scale-driven

- [ ] E2E testing (Maestro/Detox) — once core flows (auth, logging a workout) have stabilized
- [ ] Product analytics — once there's a concrete question to answer
- [ ] Component workshop (Storybook) — once the design system has enough shared components to warrant one
- [ ] i18n — once a second market/language is actually committed to
- [ ] Feature flags / remote config — once shipping needs to be decoupled from releasing

## Technical Debt / Future Improvements

- [ ] Investigate preserving `PASSWORD_RECOVERY` state after a cold application restart. Supabase restores the session but does not replay the `PASSWORD_RECOVERY` event.
- [x] Exercise detail screen (`src/app/(app)/explore/[id].tsx`)
- [x] Exercise video playback (`src/components/youtube-embed.tsx`/`.web.tsx`, via `react-native-webview`)
- [x] Text search over the already-fetched exercise list (`src/app/(app)/explore/index.tsx`, combined with muscle-group filtering)
- [x] Programs Foundation: dedicated tab + list screen (`src/app/(app)/programs/index.tsx`, `src/lib/supabase/programs.ts`, `src/components/program-card.tsx`)
- [x] Program Detail: read-only day/exercise view (`src/app/(app)/programs/[id].tsx`, `getProgramDetail` in `src/lib/supabase/programs.ts`)
- [x] Program Creation Wizard, steps 1-4 (name/type/level/days-count) with a per-day list and its own Exercise Picker (`src/app/(app)/programs/exercise-picker.tsx`), all local-only via `src/stores/program-wizard-store.ts` — no Supabase writes yet
- [x] Program Creation Wizard's final write — `createProgram` in `src/lib/supabase/programs.ts` (sequential `programs` → `program_days` → `program_exercises` inserts, matching web's RLS-required order, with best-effort cleanup of already-committed rows on partial failure), wired into `src/app/(app)/programs/create.tsx` (submit-button loading/disabled state, success navigates to the new Program Detail screen, failure preserves all wizard data for retry)
- [x] Program Deletion — `deleteProgram` in `src/lib/supabase/programs.ts` (single `programs` delete relying on verified `ON DELETE CASCADE` through `program_days`/`program_exercises`/`training_history`, not a port of web's four-step manual delete), wired into `src/app/(app)/programs/[id].tsx` (ownership check via `user_id`, native/web confirm dialog, `router.replace` to the programs list on success)
- [x] Authentication functional parity — Google Sign-In (`signInWithGoogle` in `src/lib/supabase/auth.ts`, browser-redirect via `expo-web-browser`/`WebBrowser.openAuthSessionAsync`, reusing the existing `authCallbackUrl`/`exchangeCodeForSession` PKCE plumbing) and Register `firstName`/`lastName` fields populating `full_name`/`avatar_url` metadata to match web's `registerUserWithEmail` exactly; manually verified working on the custom development build and web
- [x] Design-system alignment with web, phase one — extended `theme.ts` with web's navy-tinted palette (`text`/`background` updated, new `title`/`border` tokens, all confirmed live against `ui/variables.scss`), moved `ThemedText`'s `linkPrimary` off its hardcoded `#3c87f7` onto the theme system, introduced a shared `Button` (`src/components/button.tsx` — outlined/bordered, not filled) and migrated every primary filled-button call site to it, and restyled `AuthTextField`/`ProgramCard`/`ScreenHeader` to the same bordered, 4px-radius language; `backgroundElement`/`backgroundSelected`/`danger` deliberately unchanged, and `ProgramCard` kept its left-aligned layout rather than adopting web's centered text — see `docs/decisions.md`
- [ ] Design-system alignment with web, phase two — Explore/muscle-group-filter/exercise-picker selection styling (still filled via `backgroundElement`/`backgroundSelected`), the exercise-picker's own remaining hardcoded `#3c87f7` selection badge, and native tab bar color re-tuning once the new palette has settled
- [x] Shared screen layout/header foundation — `ScreenLayout` (`src/components/screen-layout.tsx`, the centered non-scrolling shell) and `ScreenHeader` (`src/components/screen-header.tsx`, a back/title/right-slot row), both plain screen-rendered components rather than Stack-level header config, so `NativeTabs`/existing `headerShown: false` Stacks needed no changes; adopted in `programs/[id].tsx`, `explore/[id].tsx`, `programs/exercise-picker.tsx` (`ScreenHeader`) and `confirm-email.tsx` (`ScreenLayout`). `app-tabs.web.tsx`'s tab bar chrome also fixed — replaced leftover Expo Router starter-template branding ("Expo Starter" + a `docs.expo.dev` link) with the app's real name
- [ ] Real logo/icon artwork — web's own logo asset is a large glow/hero graphic unsuited to a small inline header mark, and mobile's app icon is still Expo's unmodified default; surfaced during the branding fix above but out of scope for navigation-structure work
- [x] Home tab — global training-history activity feed (`getTrainingHistoryFeed` in `src/lib/supabase/training-history.ts`, `getExerciseIdsForProgramExercises` added to `src/lib/supabase/programs.ts`), matching web's cross-user, unfiltered feed exactly — same tables/join, same sort semantics (server-side multi-column `.order()`, verified against the actual `postgrest-js` source rather than assumed equivalent to web's client-side sort); replaces the untouched Expo-starter boilerplate in `src/app/(app)/index.tsx`
- [ ] Profile viewing route (`/profile/[id]`) — the Home feed's avatar/username renders as plain, non-interactive info rather than linking out, since mobile has no route to view another user's profile yet; a known, pre-existing gap, not introduced by this sprint
- [x] Workout Logging MVP — `src/lib/supabase/exercise-drafts.ts`/`exercise-logs.ts` (new, one-table-per-file convention) plus a new `workout.ts` orchestration-only module (`completeDay`, coordinating writes across those two and `training-history.ts`'s new `createTrainingHistoryEntry`; none of the three table modules import each other), wired into `programs/[id].tsx` via a new `WorkoutLogForm` (`src/components/workout-log-form.tsx` — per-day draft autosave-on-blur, Complete button), ownership-gated the same way Delete already is; Home's feed (`(app)/index.tsx`) now refetches via `useFocusEffect` rather than mount-only, so a freshly completed workout appears on return to Home without a full remount — see `docs/decisions.md`
- [ ] Program edit (needs real update semantics, not a port of web's broken create-duplicate behavior, and blocked on a live RLS gap — see `docs/decisions.md`), per-day workout history display (read-only past entries + refresh after completion — the write half landed in Workout Logging above; only the day-scoped `training_history` read + UI remain, deliberately deferred to keep that sprint a reviewable, independently-shippable slice), Global Programs/Complexes — not yet started
