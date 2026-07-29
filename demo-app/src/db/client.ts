import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

// The database is optional, on purpose.
//
// A Landscape without a `postgres` block is a legitimate state — it is what the
// application looks like before someone declares one. If this module threw at
// import time, the whole app would fail to render rather than degrade, and
// "add a database to a running application" would not be demonstrable.
//
// DATABASE_URL is assembled by infrastructure/codesphere/start-app.sh from the
// POSTGRES_* variables in ci.dev.yml / ci.qa.yml, or locally from .env.local.
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
