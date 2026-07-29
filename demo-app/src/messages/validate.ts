export const MAX_BODY_LENGTH = 280;

export type ValidationResult =
	| { ok: true; body: string }
	| { ok: false; error: string };

// Pure, infrastructure-free — which is what lets it run in the Codesphere
// `prepare` stage without a database.
export function validateMessageBody(input: unknown): ValidationResult {
	if (typeof input !== "string") {
		return { ok: false, error: "body must be a string" };
	}

	const body = input.trim();

	if (body.length === 0) {
		return { ok: false, error: "body must not be empty" };
	}

	if (body.length > MAX_BODY_LENGTH) {
		return {
			ok: false,
			error: `body must be at most ${MAX_BODY_LENGTH} characters`,
		};
	}

	return { ok: true, body };
}
