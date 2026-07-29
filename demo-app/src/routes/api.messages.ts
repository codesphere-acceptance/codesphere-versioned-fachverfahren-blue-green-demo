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

	// Return an explicit no-database state so the page can show setup guidance.
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
			// The page displays the configured application origin.
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
			{ error: "Database not configured for this landscape." },
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
