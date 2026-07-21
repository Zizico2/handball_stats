# Arcazzi

Arcazzi is a handball match tracking app built with the Next.js App Router and deployed to Cloudflare Workers. It supports roster setup, starting a game, a synchronized match clock, in-game event capture, and match history.

## Tech stack

| Layer | Technology |
|---|---|
| Application | [Next.js 16](https://nextjs.org/) App Router, React 19, TypeScript |
| UI | [HeroUI v3](https://www.heroui.com/) and Tailwind CSS v4 |
| API | [Hono](https://hono.dev/) routes mounted under `/api` |
| Client data | [TanStack DB](https://tanstack.com/db) query collections backed by the Hono API |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) with [Drizzle ORM](https://orm.drizzle.team/) |
| Authentication | [Clerk](https://clerk.com/) |
| Runtime | Cloudflare Workers via [OpenNext](https://opennext.js.org/) |
| Tooling | Bun, Biome, Vitest, and Playwright |

## Local setup

### Prerequisites

- [Bun](https://bun.sh/docs/installation) 1.3.14 (the version pinned in `package.json`)
- A Clerk test instance if you need to sign in or run browser tests

Wrangler is installed as a project dependency; a global installation is not required. Local D1 development and tests do not need Cloudflare credentials.

### Install and configure

```bash
bun install --frozen-lockfile
cp .env.example .env
```

Replace the Clerk placeholders in `.env` with test-instance values. `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` is used by the application, while Clerk's Playwright helpers also expect `CLERK_PUBLISHABLE_KEY` and `CLERK_SECRET_KEY`. Never commit `.env` or real credentials.

Prepare the local D1 database, then start the app:

```bash
bun run db:migrate:local
bun run dev
```

The app is available at `http://localhost:3000`. The migration command flattens the checked-in Drizzle migrations into the ignored `drizzle_flat/` directory and applies them to Wrangler's local `arcazzi` D1 database.

## Database workflow

The schema lives in `src/db/schema.ts`. After changing it, generate and apply a migration:

```bash
bun run db:generate
bun run db:migrate:local
```

Generated migrations are checked in under `drizzle/`. The beta deployment workflow is responsible for applying them to the remote beta D1 database. PR previews use a separate D1 database per pull request and delete it when the PR closes.

## Verification

Run the same non-browser gates used by CI:

```bash
bun run check
bun run test
```

Useful focused commands:

| Command | Coverage |
|---|---|
| `bun run check` | Biome lint/format checks and TypeScript |
| `bun run test:unit` | Pure Bun unit tests under `src/` |
| `bun run test:d1` | Vitest route tests using an isolated local workerd D1 binding |
| `bun run test` | Unit tests followed by D1 tests |
| `bun run preview` | OpenNext build and local Cloudflare Worker preview |

`bun run test:d1` regenerates `drizzle_flat/` and applies migrations to isolated test storage. It never connects to the remote D1 database.

## Authenticated end-to-end tests

Install Chromium once:

```bash
bunx playwright install chromium
```

Authenticated Playwright needs valid test-instance values for `CLERK_PUBLISHABLE_KEY`, `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY`, and `CLERK_SECRET_KEY`, plus an `E2E_CLERK_EMAIL` that identifies an existing Clerk test user. Mutating suites also require the same non-secret local `E2E_RESET_TOKEN` in the application and Playwright environment.

By default, Playwright starts the Next.js dev server on `PLAYWRIGHT_PORT` and runs the suite against it:

```bash
bun run test:e2e
```

Set `PLAYWRIGHT_BASE_URL` to target an already-running server instead. `E2E_CLOUDFLARE_LOCAL=1` selects the prebuilt local OpenNext Worker path used by CI; that path additionally needs ephemeral D1 state and an environment file prepared by the workflow, so it is not part of ordinary developer setup.

## Continuous integration and deployment

The active GitHub Actions workflows are:

- `Quality`: runs `bun run check` on pushes to `main`.
- `Pull request`: runs quality and non-E2E tests, builds OpenNext, runs authenticated E2E against a local Worker, deploys an isolated Worker/D1 preview, smoke-tests it, and cleans up the preview D1 database when the PR closes.
- `Deploy beta`: on pushes to `main`, runs checks and tests, builds OpenNext, migrates beta D1, deploys the exact Worker version, and smoke-tests it.

Cloudflare builds, remote migrations, version uploads, and deployments are owned by CI. Local development should use `db:migrate:local` and `preview` instead.

## Troubleshooting

### Local D1 errors

Run `bun run db:migrate:local` before loading database-backed pages. If schema errors persist after migration changes, remove Wrangler's ignored local state in `.wrangler/` and rerun the migration; this discards local-only data.

### Clerk sign-in fails

Confirm that the two publishable-key variables contain the same Clerk test-instance key and that `CLERK_SECRET_KEY` belongs to that instance. Restart the dev server after changing `.env`. Placeholder values intentionally do not authenticate.

### Authenticated Playwright skips or cannot sign in

Check all three Clerk variables and verify `E2E_CLERK_EMAIL` exists in the same Clerk test instance. For mutating suites, ensure `E2E_RESET_TOKEN` is non-empty and identical in the app and test process. Delete `playwright/.auth/` to force a fresh session after changing users or keys.

### Playwright cannot reach the app

When `PLAYWRIGHT_BASE_URL` is set, Playwright assumes that server is already running. Start `bun run dev`, correct the URL/port, or unset the base URL so Playwright launches the dev server.

## Project structure

```text
src/
  app/           Next.js App Router pages and API entry point
  components/    React and HeroUI components
  db/            Drizzle schema and database helpers
  server/        Hono API routes and server-side domain logic
  collections.ts API-backed TanStack DB query collections
  datamodel.ts   Zod schemas and inferred domain types
drizzle/         Generated migrations (checked in)
drizzle_flat/    Flattened migrations for Wrangler D1 (ignored)
e2e/             Authenticated Playwright suites
test/d1/         Isolated D1 route tests
```

Zod schemas in `src/datamodel.ts` provide runtime validation and inferred TypeScript domain types across the API and client collections.
