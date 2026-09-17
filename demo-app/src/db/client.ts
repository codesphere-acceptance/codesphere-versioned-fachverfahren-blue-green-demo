import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// The database is optional because a landscape may be synced before a
// `postgres` service exists. Return null instead of throwing so the app can show
// a clear setup state.
//
// DATABASE_URL is assembled by infrastructure/codesphere/start-app.sh from
// POSTGRES_* variables in ci.qa.yml, or locally from .env.local.
function createDb() {
	const connectionString = process.env.DATABASE_URL;

	if (!connectionString) {
		return null;
	}

	return drizzle(new Pool({ connectionString }), { schema });
}

let cached: ReturnType<typeof createDb> | undefined;

/** Returns the database, or null when none is configured. */
export function getDb() {
	if (cached === undefined) {
		cached = createDb();
	}
	return cached;
}
