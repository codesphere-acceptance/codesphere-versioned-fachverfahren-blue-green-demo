#!/usr/bin/env bash
# Codesphere Marketplace catalogue client for the Fachverfahren provider.
#
# Wraps the managed-services Public API so the ATS-08 lifecycle can be driven
# from the CLI or the catalogue pipeline (.github/workflows/catalogue.yml):
#
#   validate   Parse + policy-check provider.yml locally (no network).   (8.6)
#   publish    Upsert the provider via PUT (register / update).          (8.5, 8.9)
#   list       GET providers visible to a team (visibility check).       (8.8, 8.10)
#   delete     DELETE the provider (de-register / de-provision).         (8.11, 8.12)
#
# Config comes from infrastructure/catalogue/catalogue.env (see
# catalogue.env.example) or the process environment. Idempotent by design:
# publish is an upsert; delete tolerates an already-absent provider.
#
# Usage:
#   bash infrastructure/catalogue/provider.sh <validate|publish|list|delete> [env-file]

set -euo pipefail

# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
fail() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }
need() { command -v "$1" >/dev/null 2>&1 || fail "'$1' is required but not installed."; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
TMP_DIR="$(mktemp -d)"
trap 'rm -rf "$TMP_DIR"' EXIT

COMMAND="${1:-}"
ENV_FILE="${2:-$SCRIPT_DIR/catalogue.env}"

[ -n "$COMMAND" ] || fail "no command given. Use: validate | publish | list | delete"

# ---------------------------------------------------------------------------
# Read name / schemaVersion straight from provider.yml (single source of truth).
# node is pinned by mise; no yq dependency.
# ---------------------------------------------------------------------------
PROVIDER_FILE_PATH="$REPO_ROOT/${PROVIDER_FILE:-provider.yml}"
read_provider_field() {
  node --input-type=module <<NODE
import { readFileSync } from "node:fs";
const text = readFileSync("$PROVIDER_FILE_PATH", "utf8");
// Minimal top-level scalar reader — enough for name / schemaVersion.
const m = text.match(/^$1:\\s*(\\S+)\\s*\$/m);
process.stdout.write(m ? m[1] : "");
NODE
}

# ---------------------------------------------------------------------------
# validate — local policy gate (the "verification pipeline", ATS-08 step 8.6)
# ---------------------------------------------------------------------------
validate() {
  need node
  [ -f "$PROVIDER_FILE_PATH" ] || fail "provider file not found at '$PROVIDER_FILE_PATH'."

  info "Validating $(basename "$PROVIDER_FILE_PATH") ..."
  node "$SCRIPT_DIR/validate-provider.mjs" "$PROVIDER_FILE_PATH" \
    || fail "provider.yml failed validation. See messages above."
  info "provider.yml passed all policy checks."
}

# ---------------------------------------------------------------------------
# Shared: load env + preflight for network commands
# ---------------------------------------------------------------------------
load_env_and_preflight() {
  need curl
  need jq

  # An env file is convenient locally; CI passes the same variables through the
  # process environment instead. Require one or the other. A value already
  # present in the environment wins over the file, so any knob can be overridden
  # inline, e.g.  CS_QUERY_TEAM_ID=92 provider.sh list
  local knobs="CS_TOKEN CS_API CS_TEAM_IDS CS_QUERY_TEAM_ID GIT_URL GIT_REF PROVIDER_FILE PUBLISH_METHOD"
  if [ -f "$ENV_FILE" ]; then
    local v
    for v in $knobs; do eval "_pre_$v=\${$v:-}"; done
    set -a
    # shellcheck disable=SC1090
    source "$ENV_FILE"
    set +a
    for v in $knobs; do
      local pre="_pre_$v"
      [ -n "${!pre:-}" ] && eval "$v=\${$pre}"
    done
  elif [ -z "${CS_TOKEN:-}" ]; then
    fail "no env file at '$ENV_FILE' and CS_TOKEN is not set. Copy catalogue.env.example to catalogue.env, or export the variables (as the pipeline does)."
  fi

  CS_API="${CS_API:-https://cloud.codesphere.com/api}"
  CS_API="${CS_API%/}"
  [ -n "${CS_TOKEN:-}" ] || fail "CS_TOKEN is empty in '$ENV_FILE'."

  local code
  code=$(curl -sS -o "$TMP_DIR/teams.json" -w '%{http_code}' \
    -H "Authorization: Bearer $CS_TOKEN" "$CS_API/teams") \
    || fail "could not reach $CS_API/teams. Check CS_API and network access."
  [ "$code" = "200" ] || fail "Codesphere API rejected CS_TOKEN (HTTP $code) at $CS_API/teams. Token missing, invalid, or expired."
}

# ---------------------------------------------------------------------------
# publish — idempotent upsert (ATS-08 steps 8.5 / 8.9, criteria A1/A2/A4)
# ---------------------------------------------------------------------------
publish() {
  validate
  load_env_and_preflight

  [ -n "${CS_TEAM_IDS:-}" ] || fail "CS_TEAM_IDS is empty. Org-scope the provider to at least one team (ATS-08 step 8.4 / A6)."

  # Build scope { type: team, teamIds: [ ... ] } from the comma list.
  local team_ids_json
  team_ids_json=$(printf '%s' "$CS_TEAM_IDS" | jq -R 'split(",") | map(gsub("\\s";"") | select(length>0) | tonumber)')

  # Two ways to publish (Codesphere supports both):
  #   git  (default) — Codesphere fetches provider.yml from GIT_URL@GIT_REF.
  #                    Requires the token user's Git connection to reach the
  #                    repo. This is the ATS-08 / pipeline path (A14).
  #   spec           — send the full provider definition inline, read from the
  #                    local provider.yml. No Git connection needed; handy for
  #                    local trials before the repo is wired up.
  local method="${PUBLISH_METHOD:-git}"
  local payload="$TMP_DIR/publish.json"

  if [ "$method" = "spec" ]; then
    need node
    local spec_json="$TMP_DIR/spec.json"
    node --input-type=module <<NODE > "$spec_json"
import { readFileSync } from "node:fs";
import { parse } from "yaml";
process.stdout.write(JSON.stringify(parse(readFileSync("$PROVIDER_FILE_PATH", "utf8"))));
NODE
    jq --argjson teamIds "$team_ids_json" \
      '. + { scope: { type: "team", teamIds: $teamIds } }' "$spec_json" >"$payload"
    info "Publishing provider (PUT upsert, full spec) to $CS_API/managed-services/providers ..."
    info "  scope: team $CS_TEAM_IDS   source: local $PROVIDER_FILE (inline spec)"
  else
    [ -n "${GIT_URL:-}" ] || fail "GIT_URL is empty. Set the landscape/provider repository URL (or use PUBLISH_METHOD=spec)."
    jq -n \
      --arg gitUrl "$GIT_URL" \
      --arg gitRef "${GIT_REF:-}" \
      --arg filepath "${PROVIDER_FILE:-provider.yml}" \
      --argjson teamIds "$team_ids_json" \
      '{ gitUrl: $gitUrl, filepath: $filepath, scope: { type: "team", teamIds: $teamIds } }
       + (if $gitRef == "" then {} else { gitRef: $gitRef } end)' \
      >"$payload"
    info "Publishing provider (PUT upsert, git url) to $CS_API/managed-services/providers ..."
    info "  scope: team $CS_TEAM_IDS   gitRef: ${GIT_REF:-<default branch>}"
  fi
  local code
  code=$(curl -sS -o "$TMP_DIR/publish_resp.json" -w '%{http_code}' \
    -X PUT \
    -H "Authorization: Bearer $CS_TOKEN" \
    -H 'Content-Type: application/json' \
    -d "@$payload" \
    "$CS_API/managed-services/providers") \
    || fail "publish request failed to send."

  case "$code" in
    200|201) info "Provider published (HTTP $code). It is now in the catalogue for the scoped team(s)." ;;
    *) cat "$TMP_DIR/publish_resp.json" >&2; fail "publish rejected (HTTP $code). See response above." ;;
  esac
}

# ---------------------------------------------------------------------------
# list — visibility check (ATS-08 steps 8.8 / 8.10, criteria A6/A38)
# ---------------------------------------------------------------------------
list() {
  load_env_and_preflight
  local name query
  name="$(PROVIDER_FILE="${PROVIDER_FILE:-provider.yml}" read_provider_field name)"
  query=""
  [ -n "${CS_QUERY_TEAM_ID:-}" ] && query="?teamId=$CS_QUERY_TEAM_ID"

  info "Listing providers visible to ${CS_QUERY_TEAM_ID:-<all teams for token>} ..."
  local code
  code=$(curl -sS -o "$TMP_DIR/list.json" -w '%{http_code}' \
    -H "Authorization: Bearer $CS_TOKEN" \
    "$CS_API/managed-services/providers$query") \
    || fail "list request failed to send."
  [ "$code" = "200" ] || { cat "$TMP_DIR/list.json" >&2; fail "list rejected (HTTP $code)."; }

  echo "--- providers ($CS_API/managed-services/providers$query) ---"
  jq -r '.[] | "\(.name)\t\(.schemaVersion // .version)\t\(.scope // "?")\t\(.displayName)"' "$TMP_DIR/list.json" \
    || cat "$TMP_DIR/list.json"

  if [ -n "$name" ]; then
    if jq -e --arg n "$name" 'any(.[]; .name == $n)' "$TMP_DIR/list.json" >/dev/null; then
      info "PRESENT: '$name' is visible to this team."
    else
      info "ABSENT: '$name' is NOT visible to this team (expected for other tenants / after deletion)."
    fi
  fi
}

# ---------------------------------------------------------------------------
# delete — de-register / de-provision (ATS-08 steps 8.11 / 8.12, A1/A4)
# ---------------------------------------------------------------------------
delete() {
  load_env_and_preflight
  local name version
  name="$(PROVIDER_FILE="${PROVIDER_FILE:-provider.yml}" read_provider_field name)"
  version="$(PROVIDER_FILE="${PROVIDER_FILE:-provider.yml}" read_provider_field schemaVersion)"
  [ -n "$name" ] || fail "could not read 'name' from $PROVIDER_FILE_PATH."
  [ -n "$version" ] || fail "could not read 'schemaVersion' from $PROVIDER_FILE_PATH."

  info "Deleting provider '$name' / '$version' ..."
  local code
  code=$(curl -sS -o "$TMP_DIR/delete_resp.json" -w '%{http_code}' \
    -X DELETE \
    -H "Authorization: Bearer $CS_TOKEN" \
    "$CS_API/managed-services/providers/$name/$version") \
    || fail "delete request failed to send."

  case "$code" in
    200|204) info "Provider deleted (HTTP $code). Underlying instances are de-provisioned by Codesphere." ;;
    404) info "Provider '$name/$version' already absent (HTTP 404) — nothing to do." ;;
    *) cat "$TMP_DIR/delete_resp.json" >&2; fail "delete rejected (HTTP $code). See response above." ;;
  esac
}

case "$COMMAND" in
  validate) validate ;;
  publish)  publish ;;
  list)     list ;;
  delete)   delete ;;
  *) fail "unknown command '$COMMAND'. Use: validate | publish | list | delete" ;;
esac
