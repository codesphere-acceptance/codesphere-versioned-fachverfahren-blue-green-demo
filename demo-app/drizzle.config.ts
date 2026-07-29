import { defineConfig } from "drizzle-kit";

// drizzle-kit is a migration tool, not the app runtime, so it only ever needs
// DATABASE_URL. Raw process.env access is intentional — drizzle-kit fails
// immediately with a clear error if it is absent.
export default defineConfig({
	dialect: "postgresql",
	schema: ["./src/db/schema.ts"],
	out: "./drizzle",
	dbCredentials: {
		url: process.env.DATABASE_URL!,
	},
	migrations: {
		table: "__demo_drizzle_migrations",
		schema: "drizzle",
	},
});
