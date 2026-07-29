import { defineConfig } from "vitest/config";
import tsconfigPaths from "vite-tsconfig-paths";

// These tests are deliberately infrastructure-free so they can run in the
// Codesphere `prepare` stage. Anything needing a real Postgres belongs in
// external CI — see docs/one-loop.md, Phase 4.
export default defineConfig({
	plugins: [tsconfigPaths({ projects: ["./tsconfig.json"] })],
	test: {
		environment: "node",
		include: ["src/**/*.test.ts"],
	},
});
