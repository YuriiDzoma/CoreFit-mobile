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
- [ ] Exercise video playback (`video_url`, likely via `react-native-webview` — not yet added) and text search over the already-fetched exercise list.
