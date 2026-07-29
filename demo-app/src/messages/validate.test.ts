import { describe, expect, it } from "vitest";
import { MAX_BODY_LENGTH, validateMessageBody } from "./validate";

describe("validateMessageBody", () => {
	it("accepts a normal message and trims it", () => {
		const result = validateMessageBody("  hello from Codesphere  ");
		expect(result).toEqual({ ok: true, body: "hello from Codesphere" });
	});

	it("rejects an empty or whitespace-only message", () => {
		expect(validateMessageBody("   ").ok).toBe(false);
		expect(validateMessageBody("").ok).toBe(false);
	});

	it("rejects a non-string body", () => {
		expect(validateMessageBody(42).ok).toBe(false);
		expect(validateMessageBody(null).ok).toBe(false);
	});

	// Keep the configured message length explicit. If the limit changes, this
	// test fails before the app accepts a different contract.
	it("rejects a message longer than the limit", () => {
		expect(MAX_BODY_LENGTH).toBe(280);
		expect(validateMessageBody("x".repeat(MAX_BODY_LENGTH)).ok).toBe(true);
		expect(validateMessageBody("x".repeat(MAX_BODY_LENGTH + 1)).ok).toBe(false);
	});
});
