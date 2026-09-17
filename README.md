# Versioned Fachverfahren — Codesphere Marketplace Demo (ATS-08)

A curated, versioned **Fachverfahren** published as a Codesphere *managed
service*. The repository is two things at once:

1. **A deployable landscape** — a small TanStack Start application with a
   Codesphere landscape definition (`ci.qa.yml`). This is the workload that
   actually runs.
2. **A curated catalogue entry** — `provider.yml` turns that landscape into a
   versioned, org-scoped, priced entry in the Codesphere Marketplace, published
   and de-provisioned through the Codesphere Public API by a CI/CD pipeline.

Together they demonstrate the full ATS-08 lifecycle: a vendor onboards a
Fachverfahren as a curated managed service via a PR that runs an automated
verification pipeline, resulting in an org-scoped catalogue entry visible in the
UI and the public API but invisible to other tenants; a newer version coexists
with the old; and the service can later be removed and de-provisioned. See
[Fachverfahren Catalogue (ATS-08)](#fachverfahren-catalogue-ats-08).

## Contents

- `provider.yml`: The curated **managed-service provider** definition — the
  catalogue entry. Declares identity, the pricing model (`configSchema.x-pricing`),
  config/secrets schemas, and the coexisting `versions` (each pinned to a
  landscape `gitRef` + `ciProfile`).
- `demo-app/`: TanStack Start application using Drizzle ORM and Postgres — the
  landscape workload the provider deploys.
- `ci.qa.yml`: The Codesphere landscape definition — builds and serves the
  compiled app. Each provider version deploys this landscape.
- `infrastructure/catalogue/`: The catalogue client (`provider.sh`:
  validate / publish / list / delete against the managed-services API), the
  local policy gate (`validate-provider.mjs`), and the consumer-side instance
  driver (`instance.sh`: create / bump / delete a deployed instance).
- `infrastructure/`: Local Postgres setup for development (`infrastructure/dev/`)
  and the Codesphere startup script used by deployed landscapes
  (`infrastructure/codesphere/`).
- `.github/workflows/catalogue.yml`: Verifies `provider.yml` on every PR and
  registers / de-registers the provider via the Public API on merge.

## Local Development

Local development runs the app on your machine. Docker Compose provides the
Postgres database, and Vite serves the app in development mode.

The Codesphere landscape uses `ci.qa.yml` and
`infrastructure/codesphere/start-app.sh` instead of the local `.env.local` file.

### Prerequisites

Only three things need to exist on your machine before mise takes over:

- [mise](https://mise.jdx.dev/) — manages Node `22.22.2`, pnpm `9.15.9`, `jq`,
  and `gh`, all pinned in `.mise.toml`. Nothing else needs to be
  brew/apt-installed for local dev or for `infrastructure/catalogue/scaffold.sh`.
- [direnv](https://direnv.net/) — auto-activates the mise toolchain (and
  loads `demo-app/.env.local` if present) whenever you `cd` into the repo,
  via the committed `.envrc`.
- Docker (with the Compose v2 plugin) — used only for the local Postgres
  database. This is the one dependency mise/direnv can't provide; everything
  else in this repo assumes it's already running.

Install mise and direnv once, then from the repo root:

```bash
direnv allow   # trust .envrc — activates the pinned toolchain from here on
mise install   # fetch node, pnpm, jq, gh at the pinned versions
mise run doctor
```

`mise run doctor` (`infrastructure/dev/doctor.sh`) checks every dependency
above — pinned tool versions, direnv activation, and the Docker daemon — and
prints a specific, actionable message for anything missing before you go any
further.

### First-Time Setup

```bash
cp demo-app/.env.example demo-app/.env.local   # edit if you change the Postgres port
pnpm install
pnpm dev:up          # start Postgres on localhost:5433
pnpm db:migrate      # apply committed Drizzle migrations
pnpm db:seed:dev     # optional sample messages
pnpm dev             # start the app at http://localhost:3000
```

With mise, `mise run setup` runs `doctor` first, then install, starts
Postgres, and applies migrations. Then run `mise run dev`.

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

**Not sure what's missing?** Run `mise run doctor` — it checks mise, direnv,
pinned tool versions, and the Docker daemon in one pass.

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

## Fachverfahren Catalogue (ATS-08)

`provider.yml` is the curated catalogue entry; `infrastructure/catalogue/provider.sh`
and `.github/workflows/catalogue.yml` drive its lifecycle through the Codesphere
managed-services Public API.

### How the pieces map to the platform

- **Curated entry with commercial terms (A2).** `provider.yml` carries the
  usual metadata *and* the pricing model as an OpenAPI vendor extension,
  `configSchema.x-pricing` (mirrored human-readably into `description`).
  Codesphere validates the definition against a strict schema, so custom data
  lives in an `x-` extension — the same mechanism used by `x-update-constraint`
  and `x-endpoint` — rather than an unknown top-level key.
- **Coexisting versions (A1, A7).** The `versions` map declares `1.0.0` and
  `1.1.0`, each pinned to its own release tag and `ciProfile`. Versions are
  append-only in Codesphere: publishing `1.1.0` adds it next to `1.0.0` instead
  of replacing it, so live instances keep running and new ones (or upgrades)
  can pick the newer version.
- **Org scope / tenant separation (A6).** Scope is *not* part of `provider.yml`
  — Codesphere takes `scope` in the publish request. The pipeline applies
  `scope: { type: team, teamIds: [...] }` from `CS_TEAM_IDS`, so the entry is
  visible only inside the vendor org.
- **Verification pipeline (A20).** Every PR touching `provider.yml` runs
  `provider.sh validate` (the `verify` job) — a no-network policy gate that
  rejects a broken curated entry before it can reach the catalogue.
- **Two role-appropriate interfaces (A13, A38).** The same entry is visible in
  the Marketplace UI and returned by `GET /managed-services/providers` (surfaced
  by `provider.sh list`).

### Step-by-step (ATS-08 8.1–8.12)

| Step | Do this | Command / place |
| --- | --- | --- |
| 8.2 add pricing field | edit `configSchema.x-pricing` | `provider.yml` |
| 8.3 bump version | add a higher entry to `versions` | `provider.yml` |
| 8.4 set org scope | set the target team id(s) | `CS_TEAM_IDS` (publish request, not the file) |
| 8.5 add to catalogue | open a PR, then merge | `catalogue.yml` → `verify`, then `register` (upsert) |
| 8.6 verification pipeline | automatic on PR | `provider.sh validate` |
| 8.7 deploy an instance | create a managed-service instance in a team | Codesphere UI · `instance.sh create` |
| 8.8 show in UI + API | list providers for the org team | Marketplace UI · `provider.sh list` |
| 8.9 bump an instance | move a running instance to `1.1.0` | Codesphere UI (service → version) · `instance.sh bump` |
| 8.10 cross-tenant check | list as a different team | `CS_QUERY_TEAM_ID` = another team → `provider.sh list` |
| 8.11 remove via PR | delete `provider.yml`, merge | `catalogue.yml` → `register` (delete) |
| 8.12 confirm gone | list again; check instances | `provider.sh list` (UI + API) |

Each entry in `versions` pins a **release tag** (`v1.0.0`, `v1.1.0`). Registering
the provider only stores metadata, but deploying or bumping an instance to a
version makes Codesphere fetch that `gitRef`, so those tags must exist:

```bash
git tag v1.0.0 <commit-of-initial-version> && git push origin v1.0.0
git tag v1.1.0 <commit-of-updated-version> && git push origin v1.1.0
```

### One-time setup

The catalogue workflow needs one GitHub secret and up to three variables.
`infrastructure/catalogue/scaffold.sh` provisions all of them from `catalogue.env`
(the same file `provider.sh` uses):

```bash
cp infrastructure/catalogue/catalogue.env.example infrastructure/catalogue/catalogue.env
# edit catalogue.env: CS_TOKEN, CS_TEAM_IDS, CS_QUERY_TEAM_ID, CS_API
gh auth login                                   # needs repo scope
bash infrastructure/catalogue/scaffold.sh
```

It sets:

- secret `CS_TOKEN` — Codesphere API token of the publishing (technical) user.
  Its Git connection is used to pull this repo, so it must have access.
- variable `CS_TEAM_IDS` — comma-separated team ids to scope the provider to (A6).
- variable `CS_QUERY_TEAM_ID` — a team id used for `list` visibility checks; set
  it to a team **outside** `CS_TEAM_IDS` to demonstrate the cross-tenant check.
- variable `CODESPHERE_INSTANCE_URL` — API origin; defaults to
  `https://cloud.codesphere.com`.

To drive the API locally instead of via CI:

```bash
cp infrastructure/catalogue/catalogue.env.example infrastructure/catalogue/catalogue.env
# edit catalogue.env: CS_TOKEN, CS_TEAM_IDS at minimum
bash infrastructure/catalogue/provider.sh validate   # local policy gate (no network)
bash infrastructure/catalogue/provider.sh publish     # PUT upsert (register/update)
bash infrastructure/catalogue/provider.sh list        # GET — visibility check
bash infrastructure/catalogue/provider.sh delete      # DELETE — de-provision
```

`infrastructure/catalogue/catalogue.env` holds a live API token — it is
gitignored; never commit it.
