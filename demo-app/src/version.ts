// The running application version, reported in the UI and the API.
//
// This constant is bumped per release and pinned by a git tag; the provider's
// `versions` map (provider.yml) maps each SemVer to its tag + ci profile. Two
// instances deployed from different versions therefore show different values
// here — which is what makes the parallel operation of versions visible in the
// demo.
export const APP_VERSION = "1.2.1";

// The tenant this instance is operated for. For a managed-service deployment
// Codesphere injects the provider's TENANT_NAME config value into the landscape
// (see ci.qa.yml); locally it is unset.
export function resolveTenantName(): string | null {
	const raw = process.env.TENANT_NAME?.trim();
	// Guard against an unset value or an unresolved Codesphere template.
	if (!raw || raw.includes("${{")) {
		return null;
	}
	return raw;
}
