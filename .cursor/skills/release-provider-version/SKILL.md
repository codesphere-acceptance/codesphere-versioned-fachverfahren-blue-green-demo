---
name: release-provider-version
description: Guide an operator through landing a new version of the Fachverfahren managed-service provider after code changes. Use when the user wants to release, publish, ship, cut, or bump a new provider/catalogue/app version, or asks how to land changes into the Codesphere Marketplace catalogue for this repo.
---

# Release a New Provider Version

Guide the operator through landing a new **coexisting** version of the
Fachverfahren managed service. Codesphere versions are **append-only**: never
edit or remove an existing entry in `provider.yml` `versions:` — add a new one.
Live instances on older versions must keep running.

A release is three coordinated things:

1. **App code** — the change itself, plus the reported version in `demo-app/src/version.ts`.
2. **Catalogue metadata** — a new entry under `versions:` in `provider.yml`.
3. **Git tag** — the immutable snapshot Codesphere fetches for that version.

## Step 0: Orient

Run these to establish the current state before proposing a version number:

```bash
git tag -l 'v*'                              # existing release tags
grep 'APP_VERSION' demo-app/src/version.ts   # current reported version
git status -sb                               # is the work committed?
```

Pick the next SemVer. Default to a **minor** bump (new feature, backward
compatible) unless the operator says otherwise. It must be higher than every
existing key in `versions:` and match `^\d+\.\d+\.\d+$`.

Confirm the chosen number and short release notes with the operator before editing.

## Step 1: Bump the reported app version

Edit the constant so the running app reports the new version in its UI/API:

```typescript
// demo-app/src/version.ts
export const APP_VERSION = "<new-version>";
```

## Step 2: Add the version to `provider.yml`

Append a new entry under `versions:` — leave all existing entries untouched:

```yaml
versions:
  # ... existing entries stay exactly as they are ...
  <new-version>:
    ciProfile: qa
    gitRef: v<new-version>
    appVersion: Mitteilungsdienst <new-version>
    description: |
      <short release notes>
```

Rules:
- `gitRef` must be `v<new-version>` — enforced by `provider.sh validate`; the
  `register` job creates this tag automatically on merge (Step 5).
- `ciProfile: qa` points at `ci.qa.yml` (the only landscape profile here).
- Do not add a `scope:` key — scope is applied at publish time from `CS_TEAM_IDS`.

## Step 3: Validate locally

Both must pass before opening a PR:

```bash
pnpm typecheck && pnpm test && pnpm build
bash infrastructure/catalogue/provider.sh validate
```

The `validate` step is the same no-network policy gate CI runs on the PR. Fix
anything it reports before continuing.

## Step 4: Open a PR and merge

- Commit the changes and open a PR touching `provider.yml`.
- The **verify** job (`.github/workflows/catalogue.yml`) runs `provider.sh validate`.
- On merge to `main`, the **register** job runs `provider.sh publish` and upserts
  the catalogue entry — including the new version — via the Codesphere Public API.

## Step 5: Tag is created automatically

Do **not** tag by hand. On merge, the `register` job runs
`infrastructure/catalogue/sync-release-tags.sh`, which creates `v<new-version>`
at the merged commit and pushes it before publishing. Existing tags are never
moved (released versions are immutable).

Just confirm it landed:

```bash
git ls-remote --tags origin "v<new-version>"
```

If you ever need to reconcile tags manually (e.g. the pipeline didn't run):

```bash
bash infrastructure/catalogue/sync-release-tags.sh
```

## Step 6: Confirm it landed

Either run the manual workflow (**Fachverfahren Catalogue → Run workflow →
action `list`**) or locally:

```bash
bash infrastructure/catalogue/provider.sh list
```

The provider should list the new version alongside the older ones.

## Step 7 (optional): Move a running instance to the new version

Existing instances stay on their current version until upgraded:

```bash
bash infrastructure/catalogue/instance.sh bump <instance-id> <new-version>
# or in the Codesphere UI: service → change version
```

## Completion checklist

Copy and track:

```
- [ ] Next SemVer chosen and confirmed with operator
- [ ] demo-app/src/version.ts APP_VERSION bumped
- [ ] New entry added to provider.yml versions: (existing entries untouched)
- [ ] pnpm typecheck && pnpm test && pnpm build pass
- [ ] provider.sh validate passes
- [ ] PR opened and merged to main (register job published)
- [ ] register auto-created tag v<new-version> (git ls-remote --tags origin)
- [ ] provider.sh list shows the new version
```

## Reference: where each thing lives

| Concern | File / place |
| --- | --- |
| App change + reported version | `demo-app/`, `demo-app/src/version.ts` |
| Catalogue version map | `provider.yml` → `versions:` |
| Landscape build/run | `ci.qa.yml` |
| Local policy gate | `infrastructure/catalogue/provider.sh validate` |
| Publish / list / delete client | `infrastructure/catalogue/provider.sh` |
| Instance create / bump / delete | `infrastructure/catalogue/instance.sh` |
| CI verify + register on merge | `.github/workflows/catalogue.yml` |
| Deployable snapshot | git tag `v<new-version>` |
