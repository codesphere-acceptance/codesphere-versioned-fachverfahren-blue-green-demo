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
}

// Data is fetched from /api/messages on the client rather than through an SSR
// loader. The demo is about the platform, and a plain fetch is one less moving
// part to explain — and one less thing to fail on stage.
function Home() {
	const [messages, setMessages] = useState<MessageView[]>([]);
	const [appBaseUrl, setAppBaseUrl] = useState("");
	const [hasDatabase, setHasDatabase] = useState(true);
	const [body, setBody] = useState("");
	const [error, setError] = useState<string | null>(null);
	const [loading, setLoading] = useState(true);

	const load = useCallback(async () => {
		const response = await fetch("/api/messages");
		const data = (await response.json()) as ListResponse;
		setMessages(data.messages);
		setAppBaseUrl(data.appBaseUrl);
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
			<h1>Messages</h1>
			<p className="origin">{appBaseUrl}</p>

			<form onSubmit={handleSubmit}>
				<input
					aria-label="Message"
					value={body}
					onChange={(event) => setBody(event.target.value)}
					placeholder={
						hasDatabase ? "Say something…" : "No database configured"
					}
					disabled={!hasDatabase}
				/>
				<button type="submit" disabled={!hasDatabase}>
					Post
				</button>
			</form>

			{error ? <p className="error">{error}</p> : null}

			{loading ? (
				<p>Loading…</p>
			) : !hasDatabase ? (
				// The "before" state of the demo: the application runs, and says
				// exactly what it is missing. Declaring a postgres block in
				// ci.yml and syncing is what makes this panel disappear.
				<p className="notice">
					<strong>No database configured.</strong> This landscape has no{" "}
					<code>postgres</code> service declared, so there is nowhere to store
					messages. Add one to <code>ci.yml</code> and sync.
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
