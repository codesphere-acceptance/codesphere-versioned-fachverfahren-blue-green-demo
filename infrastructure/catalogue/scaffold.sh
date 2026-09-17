#!/usr/bin/env bash
# IaC for the Fachverfahren catalogue pipeline (.github/workflows/catalogue.yml).
#
# Provisions the GitHub repo secret + variables the pipeline needs, from the
# same gitignored catalogue.env used by provider.sh. Idempotent, fails early
# with a specific message, and never lets the token hit the log.
#
# Sets:
#   secret    CS_TOKEN                  (the publishing user's API token)
#   variable  CS_TEAM_IDS               (org scope — comma-separated team ids)
#   variable  CS_QUERY_TEAM_ID          (team id for visibility/cross-tenant list)
#   variable  CODESPHERE_INSTANCE_URL   (API origin, derived from CS_API)
#
# Usage:
#   bash infrastructure/catalogue/scaffold.sh                 # uses ./catalogue.env
#   bash infrastructure/catalogue/scaffold.sh path/to/other.env

set -euo pipefail

fail() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }
need() { command -v "$1" >/dev/null 2>&1 || fail "'$1' is required but not installed."; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${1:-$SCRIPT_DIR/catalogue.env}"

need gh
[ -f "$ENV_FILE" ] || fail "env file not found at '$ENV_FILE'. Copy catalogue.env.example to catalogue.env and fill it in."

set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a

gh auth status >/dev/null 2>&1 || fail "gh is not authenticated. Run 'gh auth login' (or 'gh auth refresh -h github.com')."

[ -n "${CS_TOKEN:-}" ]    || fail "CS_TOKEN is empty in '$ENV_FILE'."
[ -n "${CS_TEAM_IDS:-}" ] || fail "CS_TEAM_IDS is empty in '$ENV_FILE' — the provider must be org-scoped (A6)."
CS_API="${CS_API:-https://cloud.codesphere.com/api}"
CS_API_ORIGIN="${CS_API%/api}"

# `gh repo view` takes the repo positionally; secret/variable set use -R.
GH_REPO_ARGS=()
if [ -n "${GITHUB_REPO:-}" ]; then
  GH_REPO_ARGS=(-R "$GITHUB_REPO")
  gh repo view "$GITHUB_REPO" >/dev/null 2>&1 \
    || fail "gh could not resolve repository '$GITHUB_REPO' (GITHUB_REPO in '$ENV_FILE')."
else
  gh repo view >/dev/null 2>&1 \
    || fail "gh could not resolve the target repo from the git remote. Set GITHUB_REPO in '$ENV_FILE' or run from inside the repo."
fi

info "Setting GitHub secret and variables..."

# Pipe the token with no --body flag: 'gh secret set --body -' would store the
# literal '-', not stdin (see the preview scaffold for the full explanation).
printf '%s' "$CS_TOKEN" | gh secret set CS_TOKEN "${GH_REPO_ARGS[@]+"${GH_REPO_ARGS[@]}"}" \
  || fail "failed to set GitHub secret CS_TOKEN. Check gh permissions on this repo."

gh variable set CS_TEAM_IDS "${GH_REPO_ARGS[@]+"${GH_REPO_ARGS[@]}"}" --body "$CS_TEAM_IDS" \
  || fail "failed to set GitHub variable CS_TEAM_IDS."

gh variable set CODESPHERE_INSTANCE_URL "${GH_REPO_ARGS[@]+"${GH_REPO_ARGS[@]}"}" --body "$CS_API_ORIGIN" \
  || fail "failed to set GitHub variable CODESPHERE_INSTANCE_URL."

if [ -n "${CS_QUERY_TEAM_ID:-}" ]; then
  gh variable set CS_QUERY_TEAM_ID "${GH_REPO_ARGS[@]+"${GH_REPO_ARGS[@]}"}" --body "$CS_QUERY_TEAM_ID" \
    || fail "failed to set GitHub variable CS_QUERY_TEAM_ID."
else
  info "CS_QUERY_TEAM_ID is empty — skipping (list defaults to all teams the token can see)."
fi

cat <<EOF

Catalogue pipeline scaffolding complete (${GITHUB_REPO:-current repo}):
  secret    CS_TOKEN
  variable  CS_TEAM_IDS              = $CS_TEAM_IDS
  variable  CS_QUERY_TEAM_ID         = ${CS_QUERY_TEAM_ID:-<unset>}
  variable  CODESPHERE_INSTANCE_URL  = $CS_API_ORIGIN

Next: open a PR touching provider.yml (runs the 'verify' job), or push to main
(runs 'register'). See .github/workflows/catalogue.yml.
EOF
