export const MAX_BODY_LENGTH = 280;

export type ValidationResult =
	| { ok: true; body: string }
	| { ok: false; error: string };

// Keep validation independent of infrastructure so it can run without a
// database connection.
export function validateMessageBody(input: unknown): ValidationResult {
	if (typeof input !== "string") {
		return { ok: false, error: "Message text must be a string." };
	}

	const body = input.trim();

	if (body.length === 0) {
		return { ok: false, error: "Enter a message before saving." };
	}

	if (body.length > MAX_BODY_LENGTH) {
		return {
			ok: false,
			error: `Messages can be up to ${MAX_BODY_LENGTH} characters.`,
		};
	}

	return { ok: true, body };
}
