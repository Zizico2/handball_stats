## Handball Stats

A local-first handball match tracking app built with Next.js App Router.

The app is focused on three flows:

1. Create teams and players.
2. Start a new game by selecting the home team.
3. Record in-game events (attack, defense, sanction) with a running match clock.

Today, data is stored in browser local storage through TanStack DB collections to speed up onboarding and product iteration.
This is a temporary development setup: the alpha version will use server-backed collections.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript (strict mode) |
| Runtime | [Cloudflare Workers](https://workers.cloudflare.com/) (edge) |
| Package Manager | [Bun](https://bun.sh/) |
| Linting & Formatting | [Biome](https://biomejs.dev/) |
| Deployment | [Cloudflare Workers](https://workers.cloudflare.com/) via [OpenNext](https://opennext.js.org/) |
| CI/CD | GitHub Actions |
| Component Library | [MUI](https://mui.com/) |

## Onboarding: Bun Commands

### Prerequisites

1. Install Bun: https://bun.sh/docs/installation
2. Use a recent Node-compatible runtime environment (already handled by Bun in normal setup).

### Install dependencies

```bash
bun install
```

### Run the app locally

```bash
bun run dev
```

### Quality checks

```bash
bun run lint
bun run format-check
```

### Auto-format code

```bash
bun run format
```

### Production build

```bash
bun run build
```

### Cloudflare/OpenNext workflow

```bash
bun run build:cf
bun run preview
bun run deploy:cf
```

### Generate Cloudflare environment types

```bash
bun run cf-typegen
```

## Zod Schemas (Data Model)

The app uses Zod in `src/datamodel.ts` to define and validate all domain data.

Key points:

1. `playerEventSchema` is a discriminated union by `eventType`, covering attack, defense, and sanction events.
2. Every player event extends a shared base shape (`id`, `player`, `game_id`, `ellapsed_seconds`).
3. `shotSchema` validates shot payloads and includes a domain rule: an `OffTarget` shot cannot be marked as goal.
4. Team/game entities (`teamSchema`, `teamPlayerSchema`, `gameSchema`, `activeGameSchema`) define the rest of the app state with typed inference used across the UI.

This gives runtime validation plus strong TypeScript types from a single source of truth.

## TanStack DB Collections

Collections are defined in `src/collections.ts` with `createCollection` + `localStorageCollectionOptions`.

Each collection has:

1. A storage key in local storage.
2. A Zod schema for runtime validation.
3. A key selector (`getKey`) for item identity.

Current collections:

1. `playerEventsCollection` (`game-events`) for recorded match events.
2. `teamsCollection` (`teams`) for teams.
3. `teamPlayersCollection` (`team-players`) for roster players.
4. `gamesCollection` (`games`) for historical games.
5. `activeGameCollection` (`active-game`) for the currently active game pointer.

Current state: local storage is used only for development and iteration speed.
Planned alpha state: collections will be server-backed, while keeping the same schema-driven validation approach.

