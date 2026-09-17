#!/usr/bin/env bash
# Codesphere run-stage entrypoint for the demo-app fullstack service.
#
# Consumes the artifact produced by the prepare stage (demo-app/.output, kept on
# the _workspace volume) and brings the service up in the correct order:
#   1. apply committed Drizzle migrations against the managed Postgres
#   2. start the Nitro SSR server in the foreground
#
# Env contract (provided by ci.qa.yml):
#   POSTGRES_HOST        required — managed Postgres hostname from Codesphere templates
#   POSTGRES_PORT        optional — managed Postgres port (default 5432)
#   POSTGRES_USER        required — application DB user configured on the provider
#   POSTGRES_PASSWORD    required — application DB password from the vault
#   POSTGRES_DB          required — application DB name configured on the provider
#   APP_BASE_URL         required — public app origin
#   PORT                 optional — bind port (default 3000)
set -euo pipefail

require_env() {
	local name="$1"
	local value="${!name:-}"
	if [[ -z "$value" ]]; then
		echo "error: $name is required" >&2
		exit 1
	fi
	# Catch a Codesphere template that never got substituted. Without this the
	# app starts with a literal "${{ vault.X }}" and fails much later, somewhere
	# far less obvious.
	if [[ "$value" == *'${{'* ]]; then
		echo "error: $name contains an unresolved Codesphere template" >&2
		exit 1
	fi
}

build_database_url() {
	require_env POSTGRES_HOST
	require_env POSTGRES_USER
	require_env POSTGRES_PASSWORD
	require_env POSTGRES_DB
	export POSTGRES_PORT="${POSTGRES_PORT:-5432}"
	require_env POSTGRES_PORT

	node --input-type=module <<'NODE'
const required = ["POSTGRES_HOST", "POSTGRES_PORT", "POSTGRES_USER", "POSTGRES_PASSWORD", "POSTGRES_DB"];
for (const key of required) {
	if (!process.env[key]) {
		console.error(`error: ${key} is required`);
		process.exit(1);
	}
}

const url = new URL("postgresql://placeholder");
url.hostname = process.env.POSTGRES_HOST;
url.port = process.env.POSTGRES_PORT;
url.username = process.env.POSTGRES_USER;
url.password = process.env.POSTGRES_PASSWORD;
url.pathname = `/${process.env.POSTGRES_DB}`;

process.stdout.write(url.toString());
NODE
}

validate_database_url() {
	require_env DATABASE_URL
	case "$DATABASE_URL" in
		postgres://* | postgresql://*) ;;
		*)
			echo "error: DATABASE_URL must be a postgres:// or postgresql:// URL" >&2
			exit 1
			;;
	esac
}

export PORT="${PORT:-3000}"
export NODE_ENV="${NODE_ENV:-production}"
require_env APP_BASE_URL

# The database is optional. A landscape with no `postgres` service declared is a
# legitimate state — it is what the application looks like before someone
# declares one — so this starts without a database rather than refusing to boot.
# The app reports the missing database in its UI; see src/db/client.ts.
if [[ -n "${POSTGRES_HOST:-}" ]]; then
	DATABASE_URL="$(build_database_url)"
	export DATABASE_URL
	validate_database_url

	pnpm --dir demo-app db:migrate:ci
else
	echo "no POSTGRES_HOST set — starting without a database"
fi

echo "starting Nitro production server"
exec pnpm --dir demo-app start
