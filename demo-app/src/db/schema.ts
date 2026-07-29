import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// One table. The demo needs exactly enough persistence to prove the managed
// Postgres declared in ci.dev.yml is real and reachable.
export const messagesTable = pgTable("messages", {
	id: serial("id").primaryKey(),
	body: text("body").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;
