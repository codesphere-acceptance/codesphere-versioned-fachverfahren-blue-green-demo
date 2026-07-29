import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";

export const Route = createRootRoute({
	head: () => ({
		meta: [
			{ charSet: "utf-8" },
			{ name: "viewport", content: "width=device-width, initial-scale=1" },
			{ title: "Codesphere Demo App" },
		],
	}),
	shellComponent: RootDocument,
});

// Styles are inline and minimal on purpose. The demo is about the platform,
// not the design system — anything more competes for attention on a projector.
const STYLES = `
  :root { color-scheme: light dark; }
  body {
    font-family: ui-sans-serif, system-ui, -apple-system, sans-serif;
    max-width: 42rem; margin: 0 auto; padding: 2rem 1.5rem; line-height: 1.5;
  }
  h1 { font-size: 1.5rem; margin-bottom: 0.25rem; }
  .origin { font-size: 0.8rem; opacity: 0.6; margin: 0 0 2rem; font-family: ui-monospace, monospace; }
  form { display: flex; gap: 0.5rem; margin-bottom: 1.5rem; }
  input { flex: 1; padding: 0.5rem 0.75rem; font-size: 1rem; border: 1px solid currentColor; border-radius: 0.375rem; background: transparent; color: inherit; }
  button { padding: 0.5rem 1rem; font-size: 1rem; border-radius: 0.375rem; border: 1px solid currentColor; background: transparent; color: inherit; cursor: pointer; }
  ul { list-style: none; padding: 0; }
  li { padding: 0.75rem 0; border-bottom: 1px solid rgba(128,128,128,0.25); }
  time { display: block; font-size: 0.75rem; opacity: 0.6; font-family: ui-monospace, monospace; }
  .error { color: #b00020; font-size: 0.875rem; }
  .notice {
    border: 1px dashed currentColor; border-radius: 0.375rem;
    padding: 1rem; opacity: 0.85; font-size: 0.9rem;
  }
  code { font-family: ui-monospace, monospace; font-size: 0.85em; }
`;

function RootDocument({ children }: { children: ReactNode }) {
	return (
		<html lang="en">
			<head>
				<HeadContent />
				{/* biome-ignore lint/security/noDangerouslySetInnerHtml: inline styles keep the demo dependency-free */}
				<style dangerouslySetInnerHTML={{ __html: STYLES }} />
			</head>
			<body>
				{children}
				<Scripts />
			</body>
		</html>
	);
}
