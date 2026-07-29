import { getDb } from "./client";
import { messagesTable } from "./schema";

// Runs only when SEED_DEV=1, which ci.dev.yml sets and ci.qa.yml does not.
// That single flag is one of the three differences between the two profiles.
const SEED_MESSAGES = [
	{ body: "This workspace was configured from versioned code." },
	{ body: "The database was added from the landscape file." },
];

async function main(): Promise<void> {
	const db = getDb();

	if (!db) {
		console.log("seed: no database configured, skipping");
		return;
	}

	const existing = await db.select().from(messagesTable).limit(1);

	if (existing.length > 0) {
		console.log("seed: messages already present, skipping");
		return;
	}

	await db.insert(messagesTable).values(SEED_MESSAGES);
	console.log(`seed: inserted ${SEED_MESSAGES.length} messages`);
}

main()
	.then(() => process.exit(0))
	.catch((error: unknown) => {
		console.error("seed failed:", error);
		process.exit(1);
	});
