import { createFileRoute } from "@tanstack/react-router";
import type { FormEvent } from "react";
import { useCallback, useEffect, useState } from "react";

interface MessageView {
	id: number;
	body: string;
	createdAt: string;
}

interface ListResponse {
	messages: MessageView[];
	databaseConfigured: boolean;
	appBaseUrl: string;
	appVersion: string;
	tenantName: string | null;
}

// Fetch messages on the client so the page can render even when the database
// is not configured yet.
function Home() {
	const [messages, setMessages] = useState<MessageView[]>([]);
	const [appBaseUrl, setAppBaseUrl] = useState("");
	const [appVersion, setAppVersion] = useState("");
	const [tenantName, setTenantName] = useState<string | null>(null);
	const [hasDatabase, setHasDatabase] = useState(true);
	const [body, setBody] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		const response = await fetch("/api/messages");
		const data = (await response.json()) as ListResponse;
		setMessages(data.messages);
		setAppBaseUrl(data.appBaseUrl);
		setAppVersion(data.appVersion);
		setTenantName(data.tenantName);
		setHasDatabase(data.databaseConfigured);
		setLoading(false);
	}, []);

	useEffect(() => {
		void load();
	}, [load]);

	async function handleSubmit(event: FormEvent) {
		event.preventDefault();
		setError(null);

		const response = await fetch("/api/messages", {
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({ body }),
		});

		if (!response.ok) {
			const data = (await response.json()) as { error?: string };
			setError(data.error ?? "Could not save the message");
			return;
		}

		setBody("");
		await load();
	}

	return (
		<main>
			<h1>Landscape messages</h1>
			<p className="origin">{appBaseUrl}</p>
			{appVersion ? (
				<p className="meta">
					Version <strong>{appVersion}</strong>
					{tenantName ? (
						<>
							{" "}
							· Mandant: <strong>{tenantName}</strong>
						</>
					) : null}
				</p>
			) : null}

			<form onSubmit={handleSubmit}>
				<input
					aria-label="Message text"
					value={body}
					onChange={(event) => setBody(event.target.value)}
					placeholder={
						hasDatabase ? "Write a short message" : "Database not configured"
					}
					disabled={!hasDatabase}
				/>
				<button type="submit" disabled={!hasDatabase}>
					Save message
				</button>
			</form>

			{error ? <p className="error">{error}</p> : null}

			{loading ? (
				<p>Loading messages...</p>
			) : !hasDatabase ? (
				// Show setup guidance instead of an empty list when persistence is
				// unavailable.
				<p className="notice">
					<strong>Database not configured.</strong> This landscape does not
					declare a <code>postgres</code> service yet, so messages cannot be
					stored. Add the service to <code>ci.yml</code>, then sync the
					landscape.
				</p>
			) : (
				<ul>
					{messages.map((message) => (
						<li key={message.id}>
							{message.body}
							<time dateTime={message.createdAt}>{message.createdAt}</time>
						</li>
					))}
				</ul>
			)}
		</main>
	);
}

export const Route = createFileRoute("/")({
	component: Home,
});
