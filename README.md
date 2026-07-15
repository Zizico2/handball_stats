## Handball Stats

A handball match tracking app built with Next.js App Router, deployed to Cloudflare Workers.

The app covers three core flows:

1. **Create teams and players** — build rosters before a match.
2. **Start a new game** — select the home team and kick off.
3. **Record in-game events** — log attack, defense, and sanction events against a running match clock.

## Tech Stack

| Layer | Technology |
|---|---|
| Framework | [Next.js 16](https://nextjs.org/) (App Router) |
| Language | TypeScript (strict mode) |
| Runtime / Deployment | [Cloudflare Workers](https://workers.cloudflare.com/) via [OpenNext](https://opennext.js.org/) |
| Database | [Cloudflare D1](https://developers.cloudflare.com/d1/) (SQLite) |
| ORM | [Drizzle ORM](https://orm.drizzle.team/) |
| Package Manager | [Bun](https://bun.sh/) |
| Linting & Formatting | [Biome](https://biomejs.dev/) |
| Auth | [Clerk](https://clerk.com/) |
| Component Library | [MUI](https://mui.com/) |
| CI/CD | GitHub Actions |

---

## Local Development

### Prerequisites

| Tool | Install |
|---|---|
| **Bun** | https://bun.sh/docs/installation |
| **Wrangler** (Cloudflare CLI) | Installed as a dev dependency — no global install needed |

### 1. Install dependencies

```bash
bun install
```

### 2. Run database migrations (local D1)

Drizzle generates migrations into `drizzle/`, but Wrangler expects flat SQL files.
The `db:migrate:local` script handles both flattening and applying:

```bash
bun run db:migrate:local
```

> This runs `flatten.ts` to copy migration files into `drizzle_flat/`, then applies them to the local D1 database with Wrangler.

### 3. Start the dev server

```bash
bun run dev
```

The app will be available at `http://localhost:3000`.

---

## Database Workflow (Drizzle + D1)

The schema lives in `src/db/schema.ts`. When you change it:

1. **Generate a new migration:**

   ```bash
   bun run db:generate
   ```

   This creates a new migration folder under `drizzle/`.

2. **Apply locally:**

   ```bash
   bun run db:migrate:local
   ```

3. **Apply to production:**

   ```bash
   bun run db:migrate:prod
   ```

> Production migrations require Wrangler authentication with your Cloudflare account.

---

## Testing

Non-E2E tests are split into two tiers:

| Command | What it runs |
|---|---|
| `bun run test` | Full non-E2E gate: unit tests, then D1 route tests |
| `bun run test:unit` | Fast pure Bun suites (phase logic, match clock, mappers) under `src/` |
| `bun run test:d1` | Database route tests in local workerd with an isolated D1 binding |

`bun run test:d1` regenerates `drizzle_flat/` from checked-in `drizzle/` migrations and applies those files to Vitest’s isolated local D1 storage. It does **not** use the remote D1 database and needs no Cloudflare credentials.

Only database-backed route tests use D1. Pure logic suites stay on Bun.

---

## Code Quality

[Biome](https://biomejs.dev/) handles both linting and formatting.

```bash
# Lint the project
bun run lint

# Check formatting (CI-safe, no writes)
bun run format-check

# Auto-format
bun run format
```

---

## Cloudflare / OpenNext Deployment

Build and deploy the app to Cloudflare Workers via OpenNext:

```bash
# Build for Cloudflare
bun run build:cf

# Preview locally (full Workers runtime)
bun run preview

# Deploy to production
bun run deploy:cf
```

Generate Cloudflare environment types after changing `wrangler.toml` bindings:

```bash
bun run cf-typegen
```

---

## Project Structure

```
src/
  app/          # Next.js App Router pages and API routes
  components/   # React components
  db/           # Drizzle schema and DB client
  server/       # Hono API (routes under server/api/routes/)
  datamodel.ts  # Zod schemas — single source of truth for domain types
  collections.ts# TanStack DB collections (local storage, migrating to server-backed)
drizzle/        # Generated migrations (nested folders)
drizzle_flat/   # Flattened migrations consumed by Wrangler D1
```

## Data Model

The app uses Zod (`src/datamodel.ts`) for runtime validation and TypeScript type inference from a single source of truth.

- `playerEventSchema` — discriminated union by `eventType` (attack, defense, sanction).
- `shotSchema` — validates shot payloads; enforces that `OffTarget` shots cannot be goals.
- `teamSchema`, `teamPlayerSchema`, `gameSchema`, `activeGameSchema` — remaining domain entities.

