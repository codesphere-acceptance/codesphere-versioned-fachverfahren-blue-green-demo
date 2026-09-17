import { getDb } from "./client";
import { messagesTable } from "./schema";

// Local-only sample data, inserted by `pnpm db:seed:dev` when the messages
// table is empty. Codesphere landscapes do not run this seed.
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
