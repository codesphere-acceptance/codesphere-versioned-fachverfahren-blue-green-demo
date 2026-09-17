#!/usr/bin/env bash
# Reconcile git release tags with the versions declared in provider.yml.
#
# Each version pins a `gitRef` (by convention v<version>). Registering the
# provider only stores metadata, but deploying or bumping an instance to a
# version makes Codesphere fetch that `gitRef` — so the tag MUST exist. This
# script creates any missing tag at a target commit (default: HEAD) and pushes
# it. Existing tags are left untouched: released versions are immutable, so an
# older version's tag legitimately points at an older commit.
#
# Driven by the register job in .github/workflows/catalogue.yml (target =
# github.sha, the merged commit), but also runnable by hand from the repo.
#
# Usage: bash infrastructure/catalogue/sync-release-tags.sh [target-commit]

set -euo pipefail

fail() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }
need() { command -v "$1" >/dev/null 2>&1 || fail "'$1' is required but not installed."; }

need node
need git

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
cd "$REPO_ROOT" # so provider.yml and the pinned `yaml` dep resolve from here

[ -f provider.yml ] || fail "provider.yml not found at $REPO_ROOT/provider.yml."

TARGET="${1:-HEAD}"
SHA="$(git rev-parse --verify "${TARGET}^{commit}")" \
  || fail "cannot resolve target commit '$TARGET'."

# The gitRefs declared in provider.yml, one per line (uses the pinned yaml dep).
mapfile -t REFS < <(node --input-type=module <<'NODE'
import { readFileSync } from "node:fs";
import { parse } from "yaml";
const doc = parse(readFileSync("provider.yml", "utf8"));
for (const spec of Object.values(doc?.versions ?? {})) {
  if (spec && spec.gitRef) console.log(spec.gitRef);
}
NODE
)

if [ "${#REFS[@]}" -eq 0 ]; then
  info "no versions[*].gitRef declared in provider.yml — nothing to tag."
  exit 0
fi

created=0
for ref in "${REFS[@]}"; do
  if git rev-parse -q --verify "refs/tags/$ref^{commit}" >/dev/null 2>&1; then
    info "tag '$ref' already exists — leaving untouched (released versions are immutable)."
    continue
  fi
  info "creating tag '$ref' -> $SHA and pushing to origin."
  git tag "$ref" "$SHA"
  git push origin "refs/tags/$ref"
  created=$((created + 1))
done

info "done — $created new release tag(s) created."
