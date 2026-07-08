# CoreFit Mobile

A universal (iOS, Android, web) fitness app built with Expo.

## Stack

| Layer | Choice |
|---|---|
| Framework | Expo (SDK 57), React Native 0.86, React 19 |
| Routing | Expo Router (file-based, typed routes) |
| Backend | Supabase (auth, Postgres, storage) |
| Server state | TanStack Query |
| Client state | Zustand |
| Forms | React Hook Form |
| Validation | Zod |
| Styling | React Native `StyleSheet` + theme tokens (`src/constants/theme.ts`) |
| Language | TypeScript (strict) |

See `docs/decisions.md` for the reasoning behind each choice.

## Quick start

```bash
npm install
cp .env.example .env   # fill in your Supabase URL + anon key
npm start
```

Full setup instructions, including EAS build profiles: `docs/setup.md`.

## Scripts

| Command | Description |
|---|---|
| `npm start` | Start the Expo dev server |
| `npm run android` | Start and open on Android |
| `npm run ios` | Start and open on iOS |
| `npm run web` | Start and open on web |
| `npm run lint` | Run `expo lint` |
| `npm run reset-project` | Move starter code aside and start from a blank `app/` |

## Project structure

Routes live in `src/app` (file-based via Expo Router). Shared UI is in `src/components`, hooks in `src/hooks`, design tokens in `src/constants/theme.ts`.

## Documentation

- [`docs/architecture.md`](docs/architecture.md) — current structure and planned layers
- [`docs/decisions.md`](docs/decisions.md) — why each part of the stack was chosen
- [`docs/roadmap.md`](docs/roadmap.md) — prioritized implementation plan
- [`docs/setup.md`](docs/setup.md) — environment and EAS setup

## Learn more

- [Expo documentation](https://docs.expo.dev/)
- [Expo Router](https://docs.expo.dev/router/introduction/)
- [Supabase documentation](https://supabase.com/docs)
