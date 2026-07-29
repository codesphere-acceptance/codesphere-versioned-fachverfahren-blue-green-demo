import { pgTable, serial, text, timestamp } from "drizzle-orm/pg-core";

// Store each submitted message with the time Postgres received it.
export const messagesTable = pgTable("messages", {
	id: serial("id").primaryKey(),
	body: text("body").notNull(),
	createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type Message = typeof messagesTable.$inferSelect;
export type NewMessage = typeof messagesTable.$inferInsert;
