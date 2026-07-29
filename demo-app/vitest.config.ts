import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// Unit tests run without external services so they can execute before the app
// connects to Postgres.
export default defineConfig({
	plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
