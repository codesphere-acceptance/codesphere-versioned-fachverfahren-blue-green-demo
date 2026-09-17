// Local policy gate for the curated Fachverfahren provider.yml.
//
// This is the "automated verification pipeline": it applies the curation policies
// the catalogue enforces before a provider is published. It is intentionally
// strict and dependency-
// light — it parses the YAML and asserts the shape Codesphere expects, plus the
// vendor-specific policies this demo cares about (pricing present, tenant
// scoping left to publish time, coexisting versions).
//
// Usage: node validate-provider.mjs <path-to-provider.yml>
// Exit code 0 = all policies pass; 1 = one or more violations.

import { readFileSync } from "node:fs";
import { parse } from "yaml";

const file = process.argv[2];
if (!file) {
	console.error("usage: node validate-provider.mjs <path-to-provider.yml>");
	process.exit(2);
}

const errors = [];
const warnings = [];
const err = (m) => errors.push(m);
const warn = (m) => warnings.push(m);

let doc;
try {
	doc = parse(readFileSync(file, "utf8"));
} catch (e) {
	console.error(`error: provider.yml is not valid YAML: ${e.message}`);
	process.exit(1);
}

if (!doc || typeof doc !== "object") {
	console.error("error: provider.yml did not parse to an object.");
	process.exit(1);
}

// --- Identity ------------------------------------------------------------
if (!/^[-a-z0-9_]+$/.test(doc.name ?? "")) {
	err("`name` is required and must match ^[-a-z0-9_]+$.");
}
if (!/^v[0-9]+$/.test(doc.schemaVersion ?? "")) {
	err("`schemaVersion` is required and must match ^v[0-9]+ (e.g. v1).");
}

// --- Required curated metadata (catalogue is more than a name) -----------
for (const field of ["displayName", "author", "category", "description", "iconUrl"]) {
	if (!doc[field] || String(doc[field]).trim() === "") {
		err(`\`${field}\` is required for a curated catalogue entry.`);
	}
}

// --- Landscape backend ---------------------------------------------------
const gitUrl = doc?.backend?.landscape?.gitUrl;
if (!gitUrl || !/^https?:\/\//.test(gitUrl)) {
	err("`backend.landscape.gitUrl` is required and must be an http(s) URL.");
}

// --- Config / secrets schemas -------------------------------------------
if (!doc.configSchema || typeof doc.configSchema !== "object") {
	err("`configSchema` is required (OpenAPI schema object).");
}
if (!doc.secretsSchema || typeof doc.secretsSchema !== "object") {
	err("`secretsSchema` is required (OpenAPI schema object).");
}

// --- Pricing model must be expressed -------------------------------------
const pricing = doc?.configSchema?.["x-pricing"];
if (!pricing || typeof pricing !== "object") {
	err("pricing policy: `configSchema.x-pricing` is required — the curated entry must express its commercial terms.");
} else {
	for (const key of ["model", "currency", "billingPeriod"]) {
		if (!pricing[key]) err(`pricing policy: \`configSchema.x-pricing.${key}\` is required.`);
	}
}

// --- Scope is a publish-time act, not in the file --------------------------
if (doc.scope) {
	warn("`scope` should not live in provider.yml — Codesphere takes it in the publish request. The pipeline applies org scope from CS_TEAM_IDS. Remove `scope` from the file.");
}

// --- Versions (lifecycle + coexistence) ----------------------------------
const versions = doc.versions;
const semver = /^\d+\.\d+\.\d+(?:[-+][0-9A-Za-z-.]+)?$/;
if (!versions || typeof versions !== "object" || Array.isArray(versions)) {
	err("`versions` is required and must be a map of SemVer -> { gitRef, ciProfile }.");
} else {
	const keys = Object.keys(versions);
	if (keys.length === 0) err("`versions` must declare at least one version.");
	if (keys.length < 2) {
		warn(`only ${keys.length} version declared — declare a second, higher version so it can coexist with the live one.`);
	}
	for (const [ver, spec] of Object.entries(versions)) {
		if (!semver.test(ver)) err(`version key '${ver}' is not valid SemVer.`);
		if (!spec || typeof spec !== "object") {
			err(`version '${ver}' must be an object with gitRef and ciProfile.`);
			continue;
		}
		if (!spec.gitRef) {
			err(`version '${ver}' is missing required \`gitRef\`.`);
		} else if (spec.gitRef !== `v${ver}`) {
			// The register pipeline auto-creates this tag at the merged commit, so
			// the ref must be derivable from the version key. Enforce the convention.
			err(`version '${ver}' must set \`gitRef: v${ver}\` (release-tag convention) — found '${spec.gitRef}'.`);
		}
		if (!spec.ciProfile) err(`version '${ver}' is missing required \`ciProfile\`.`);
	}
}

// --- Report --------------------------------------------------------------
for (const w of warnings) console.warn(`warning: ${w}`);
for (const e of errors) console.error(`error: ${e}`);

if (errors.length > 0) {
	console.error(`\n${errors.length} policy violation(s) — provider.yml rejected.`);
	process.exit(1);
}
console.log(`OK: provider.yml passed ${warnings.length ? `with ${warnings.length} warning(s)` : "with no warnings"}.`);
process.exit(0);
