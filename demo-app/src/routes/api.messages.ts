import { createFileRoute } from "@tanstack/react-router";
import { desc } from "drizzle-orm";
import { getDb } from "#/db/client";
import { messagesTable } from "#/db/schema";
import { validateMessageBody } from "#/messages/validate";

const NO_STORE = { "Cache-Control": "no-store" };

async function listMessagesHandler(_ctx: {
	request: Request;
}): Promise<Response> {
	const db = getDb();

	// No database declared yet. Report that plainly rather than failing — the
	// page renders and says so.
	if (!db) {
		return Response.json(
			{
				messages: [],
				databaseConfigured: false,
				appBaseUrl: process.env.APP_BASE_URL ?? "(unset)",
			},
			{ headers: NO_STORE },
		);
	}

	const messages = await db
		.select()
		.from(messagesTable)
		.orderBy(desc(messagesTable.createdAt))
		.limit(50);

	return Response.json(
		{
			messages,
			databaseConfigured: true,
			// Surfaced so the page can display which stage it is running as.
			// dev resolves this to the workspace dev domain, qa to a stable
			// origin from workspace env — the visible half of the profile diff.
			appBaseUrl: process.env.APP_BASE_URL ?? "(unset)",
		},
		{ headers: NO_STORE },
	);
}

async function createMessageHandler(ctx: {
	request: Request;
}): Promise<Response> {
	const db = getDb();

	if (!db) {
		return Response.json(
			{ error: "No database is configured for this landscape." },
			{ status: 503, headers: NO_STORE },
		);
	}

	const payload = (await ctx.request.json().catch(() => null)) as {
		body?: unknown;
	} | null;

	const result = validateMessageBody(payload?.body);

	if (!result.ok) {
		return Response.json(
			{ error: result.error },
			{ status: 400, headers: NO_STORE },
		);
	}

	const [message] = await db
		.insert(messagesTable)
		.values({ body: result.body })
		.returning();

	return Response.json({ message }, { status: 201, headers: NO_STORE });
}

export const Route = createFileRoute("/api/messages")({
	server: {
		handlers: {
			GET: listMessagesHandler,
			POST: createMessageHandler,
		},
	},
});
