import { createFileRoute } from "@tanstack/react-router";

// Liveness only — deliberately does not touch the database, so it answers
// "is the process up?" rather than "is everything healthy?".
// ci.dev.yml / ci.qa.yml use tcp://localhost:3000 for healthEndpoint; this
// route exists for humans and for anything that wants an HTTP check.
async function liveHealthHandler(_ctx: {
	request: Request;
}): Promise<Response> {
	return Response.json(
		{ status: "ok", timestamp: new Date().toISOString() },
		{ status: 200, headers: { "Cache-Control": "no-store" } },
	);
}

export const Route = createFileRoute("/api/health/live")({
	server: {
		handlers: {
			GET: liveHealthHandler,
		},
	},
});
