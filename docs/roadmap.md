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
- [ ] App-wide visual/design-system alignment with web (colors, button/input styling, typography) — deliberately out of scope for the auth-parity work above, since mobile's current visual language is already used consistently across Programs/Profile/Explore; revisit as its own cross-app redesign, not an auth-specific change
- [ ] Program edit (needs real update semantics, not a port of web's broken create-duplicate behavior, and blocked on a live RLS gap — see `docs/decisions.md`), training history + workout logging (`exercise_drafts`/`exercise_logs`/`training_history`), Global Programs/Complexes, and the future Dashboard (Home tab) — all downstream of this foundation, not yet started
