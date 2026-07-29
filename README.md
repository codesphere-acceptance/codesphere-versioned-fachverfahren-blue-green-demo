# Codesphere Platform Demonstration

Demo application and landscape definitions for the Codesphere application developer lifecycle.

## What is here

| Path | What it is |
|---|---|
| **[demo-app/](demo-app)** | TanStack Start application with Drizzle ORM and managed Postgres |
| **[ci.dev.yml](ci.dev.yml)** / **[ci.qa.yml](ci.qa.yml)** | Landscape definitions. `dev` runs the Vite dev server with hot reload; `qa` builds and serves the compiled output |
| **[infrastructure/](infrastructure)** | Local Postgres via Docker Compose; Codesphere startup script for deployed landscapes |

## Local development

This section is about running the app **on your machine**. It is not the Codesphere **dev
stage** — that is `ci.dev.yml` deployed to a workspace. Locally, Docker Compose stands in for
managed Postgres; Vite runs the app in dev mode instead of the Nitro build from `prepare`.

### Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node** | 22.22.x | Pinned in [`.mise.toml`](.mise.toml); `>=22.22.0` in `package.json` |
| **pnpm** | 9.15.9 | Via `corepack enable` or mise |
| **Docker** | any recent | For local Postgres only |

With [mise](https://mise.jdx.dev/) installed, `mise trust` then `mise install` picks up the
right Node and pnpm automatically.

### First-time setup

```bash
cp demo-app/.env.example demo-app/.env.local   # edit if you change the Postgres port
pnpm install
pnpm dev:up          # Postgres on localhost:5433 — see docker-compose.yml
pnpm db:migrate      # apply committed Drizzle migrations
pnpm db:seed:dev     # optional — two reference messages, like ci.dev.yml's SEED_DEV=1
pnpm dev             # Vite dev server → http://localhost:3000
```

Or, with mise: `mise run setup` then `mise run dev`.

`demo-app/.env.local` is gitignored. It supplies `DATABASE_URL` and `APP_BASE_URL` to the app
and to Drizzle CLI commands. On Codesphere those values come from `ci.dev.yml` / `ci.qa.yml`
and `infrastructure/codesphere/start-app.sh` instead — `.env.local` is never used there.

### Day-to-day workflow

Postgres persists in a Docker volume between restarts. After the first setup you usually need
only:

```bash
pnpm dev:up          # if Docker was stopped
pnpm dev
```

Stop Postgres when done: `pnpm dev:down`. Wipe the database and start fresh:
`pnpm dev:reset` then `pnpm db:migrate` (and optionally `pnpm db:seed:dev`).

### Commands

All commands run from the **repository root** unless noted.

| Command | What it does |
|---|---|
| `pnpm dev` | Vite dev server with HMR (`demo-app/`, port 3000) |
| `pnpm build` | Production build → `demo-app/.output/` |
| `pnpm start` | Run the built Nitro server (needs `pnpm build` first) |
| `pnpm test` | Unit tests (Vitest; no database required) |
| `pnpm typecheck` | `tsc --noEmit` on `demo-app/` |
| `pnpm dev:up` | Start local Postgres (`infrastructure/dev/docker-compose.yml`) |
| `pnpm dev:down` | Stop Postgres, keep data volume |
| `pnpm dev:reset` | Stop Postgres and **destroy** the data volume |
| `pnpm dev:logs` | Tail Postgres container logs |
| `pnpm db:migrate` | Apply migrations (needs Postgres up + `.env.local`) |
| `pnpm db:generate` | Generate a new migration after schema changes |
| `pnpm db:seed:dev` | Insert reference messages if the table is empty |

### Quality checks

Mirrors what `ci.dev.yml` runs in `prepare` (minus the pnpm pin steps):

```bash
pnpm typecheck && pnpm test && pnpm build
```

To smoke-test the production artifact locally (what `run` actually starts on Codesphere):

```bash
pnpm build
DATABASE_URL=postgresql://demo_app:demo_app@localhost:5433/demo_app \
APP_BASE_URL=http://localhost:3000 \
pnpm start
```

Then hit http://localhost:3000 and http://localhost:3000/api/health/live.

### Troubleshooting

**Port 5433 already in use.** Another project's Postgres may be bound to it (default in
`docker-compose.yml`). Either stop that container or override the host port:

```bash
DEMO_POSTGRES_PORT=5435 pnpm dev:up
```

…and update `DATABASE_URL` in `demo-app/.env.local` to match.

**`pnpm dev:up` fails with "permission denied" on the Docker socket.** Docker Desktop (or the
daemon) is not running.

**Migrations fail / connection refused.** Postgres is not up (`pnpm dev:up`) or `.env.local`
points at the wrong port.
