import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

// On Codesphere APP_BASE_URL is https://<workspace-dev-domain>; locally it is
// http://localhost:3000. That difference is enough to detect whether we are
// running behind the Codesphere gateway, so the dev server can configure itself
// without a separate flag.
const appBaseUrl = process.env.APP_BASE_URL ?? "";
const behindGateway = appBaseUrl.startsWith("https://");
const gatewayHost = behindGateway ? new URL(appBaseUrl).hostname : undefined;

// These plugins provide path aliases, TanStack Start routing, Nitro output, and
// React support for this app.
export default defineConfig({
	server: {
		// The default can bind only ::1, so browsers resolving localhost to
		// 127.0.0.1 see connection refused.
		host: true,

		// Vite 7 rejects any request whose Host header it does not recognise:
		// "Blocked request. This host (…) is not allowed." The workspace dev
		// domain is generated per workspace, so it has to be allowed at runtime.
		// Undefined locally, where localhost is trusted by default.
		allowedHosts: gatewayHost ? [gatewayHost] : undefined,

		// The browser loads the page over HTTPS on 443 through the gateway, but
		// the HMR client would otherwise try ws://<host>:3000, which never
		// connects, silently. The page still renders, so this fails invisibly:
		// you only notice that edits stop propagating.
		hmr: behindGateway ? { clientPort: 443, protocol: "wss" } : undefined,

		// Polling is required on Codesphere, and it is not a workaround for a
		// misconfiguration; it is a consequence of the architecture.
		//
		// The Workspace (Cloud IDE) and the Landscape (this dev server) run on
		// SEPARATE COMPUTE sharing one network filesystem. inotify is a local
		// kernel facility: it reports writes made on the same node. An edit
		// saved by the Workspace pod never raises an inotify event in the
		// Landscape pod, so the default watcher sees nothing, forever.
		//
		// Polling asks the filesystem directly instead of waiting to be told.
		// Left off locally, where both sides are the same kernel and inotify
		// works normally.
		watch: behindGateway
			? {
					usePolling: true,
					interval: 300,
					binaryInterval: 1000,
					ignored: [
						"**/node_modules/**",
						"**/.git/**",
						"**/.output/**",
						"**/.nitro/**",
						"**/.tanstack/**",
						"**/coverage/**",
					],
				}
			: undefined,
	},
	plugins: [
		tsconfigPaths({ projects: ["./tsconfig.json"] }),
		tanstackStart(),
		nitro(),
		viteReact(),
	],
});
