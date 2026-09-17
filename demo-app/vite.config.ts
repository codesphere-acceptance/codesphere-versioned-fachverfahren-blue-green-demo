import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// These plugins provide path aliases, TanStack Start routing, Nitro output, and
// React support for this app.
export default defineConfig({
	server: {
		// The default can bind only ::1, so browsers resolving localhost to
		// 127.0.0.1 see connection refused.
		host: true,
	},
	plugins: [
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tanstackStart(),
		nitro(),
		viteReact(),
	],
});
