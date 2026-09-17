import { createFileRoute } from "@tanstack/react-router";

// Liveness only. It does not touch the database, so it answers "is the process
// up?" rather than "is every dependency healthy?".
// ci.qa.yml uses tcp://localhost:3000 for healthEndpoint; this route
// exists for HTTP checks.
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
