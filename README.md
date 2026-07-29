# Codesphere Platform Demonstration

A small TanStack Start application with Codesphere landscape definitions for a
development and QA setup.

## Contents

- `demo-app/`: TanStack Start application using Drizzle ORM and Postgres.
- `ci.dev.yml` and `ci.qa.yml`: Codesphere landscape definitions. The dev
  profile runs Vite with hot reload; the QA profile builds and serves the
  compiled app.
- `infrastructure/`: Local Postgres setup for development and the Codesphere
  startup script used by deployed landscapes.

## Local Development

Local development runs the app on your machine. Docker Compose provides the
Postgres database, and Vite serves the app in development mode.

The Codesphere landscapes use `ci.dev.yml`, `ci.qa.yml`, and
`infrastructure/codesphere/start-app.sh` instead of the local `.env.local` file.

### Prerequisites

- Node `22.22.x`, pinned in `.mise.toml` and required by `package.json`.
- pnpm `9.15.9`, available through `corepack enable` or mise.
- Docker, used only for the local Postgres database.

With [mise](https://mise.jdx.dev/) installed, run `mise trust` and
`mise install` to install the pinned Node and pnpm versions.

### First-Time Setup

```bash
cp demo-app/.env.example demo-app/.env.local   # edit if you change the Postgres port
pnpm install
pnpm dev:up          # start Postgres on localhost:5433
pnpm db:migrate      # apply committed Drizzle migrations
pnpm db:seed:dev     # optional sample messages
pnpm dev             # start the app at http://localhost:3000
```

With mise, `mise run setup` runs install, starts Postgres, and applies
migrations. Then run `mise run dev`.

`demo-app/.env.local` is gitignored. It provides `DATABASE_URL` and
`APP_BASE_URL` for local app and Drizzle CLI commands.

### Daily Workflow

Postgres data persists in a Docker volume between restarts. After the first
setup, the usual local workflow is:

```bash
pnpm dev:up
pnpm dev
```

Use `pnpm dev:down` to stop Postgres and keep the data volume. Use
`pnpm dev:reset` to stop Postgres and delete the volume, then run
`pnpm db:migrate` again.

### Commands

- `pnpm dev`: Starts the Vite dev server for `demo-app/` on port `3000`.
- `pnpm build`: Builds the production app into `demo-app/.output/`.
- `pnpm start`: Runs the built Nitro server. Run `pnpm build` first.
- `pnpm test`: Runs Vitest unit tests. No database is required.
- `pnpm typecheck`: Runs `tsc --noEmit` for `demo-app/`.
- `pnpm dev:up`: Starts local Postgres from
  `infrastructure/dev/docker-compose.yml`.
- `pnpm dev:down`: Stops local Postgres and keeps the data volume.
- `pnpm dev:reset`: Stops local Postgres and deletes the data volume.
- `pnpm dev:logs`: Tails the Postgres container logs.
- `pnpm db:migrate`: Applies migrations. Requires Postgres and `.env.local`.
- `pnpm db:generate`: Generates a migration after schema changes.
- `pnpm db:seed:dev`: Inserts sample messages if the table is empty.

### Quality Checks

Run the same checks used before the app starts in Codesphere:

```bash
pnpm typecheck && pnpm test && pnpm build
```

To smoke-test the production build locally:

```bash
pnpm build
DATABASE_URL=postgresql://demo_app:demo_app@localhost:5433/demo_app \
APP_BASE_URL=http://localhost:3000 \
pnpm start
```

Then open http://localhost:3000 and
http://localhost:3000/api/health/live.

### Troubleshooting

**Port 5433 is already in use.** Another local Postgres container may be using
the port. Stop that container or override the host port:

```bash
DEMO_POSTGRES_PORT=5435 pnpm dev:up
```

Then update `DATABASE_URL` in `demo-app/.env.local` to use the same port.

**`pnpm dev:up` fails with "permission denied" on the Docker socket.** Start
Docker Desktop or the Docker daemon.

**Migrations fail or connection is refused.** Start Postgres with
`pnpm dev:up` and check that `.env.local` points at the right port.
