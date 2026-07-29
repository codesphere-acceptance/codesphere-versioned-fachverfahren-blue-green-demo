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

	// ---------------------------------------------------------------------
	// THE BREAKABLE TEST.
	//
	// This is the one to break on stage for the [+EXT] prepare-gate beat.
	// Change MAX_BODY_LENGTH in validate.ts from 280 to 100 and this fails,
	// `prepare` stops, and the deploy never happens.
	//
	// It is last so the earlier assertions still pass — the failure output
	// stays short and legible on a projector.
	// ---------------------------------------------------------------------
	it("rejects a message longer than the limit", () => {
		expect(MAX_BODY_LENGTH).toBe(280);
		expect(validateMessageBody("x".repeat(MAX_BODY_LENGTH)).ok).toBe(true);
		expect(validateMessageBody("x".repeat(MAX_BODY_LENGTH + 1)).ok).toBe(false);
	});
});
