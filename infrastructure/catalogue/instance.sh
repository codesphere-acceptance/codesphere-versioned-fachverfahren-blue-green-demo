#!/usr/bin/env bash
# Consumer-side lifecycle for a deployed instance of the Fachverfahren managed
# service — the counterpart to provider.sh (which is the vendor/catalogue side).
# Exercises ATS-08 steps 8.7 (deploy an instance) and 8.9 (bump its version):
#
#   create           Deploy an instance from the catalogue in a team.        (8.7)
#   list             List a team's managed-service instances.
#   status <id>      Show one instance (state, version, hostname).
#   bump <id> <ver>  Change a running instance's version (upgrade/downgrade).  (8.9)
#   delete <id>      Remove one instance (not used in the happy-path demo).
#
# Config comes from infrastructure/catalogue/catalogue.env (CS_TOKEN, CS_API)
# plus these instance knobs (env or catalogue.env), with sensible defaults:
#   INSTANCE_TEAM_ID   team to deploy into (default: first of CS_TEAM_IDS)
#   INSTANCE_NAME      service name        (default: "Mitteilungsdienst Demo")
#   INSTANCE_TENANT    TENANT_NAME config  (default: "Musterstadt")
#   INSTANCE_VERSION   version to deploy   (default: 1.0.0)
#   POSTGRES_PASSWORD / POSTGRES_SUPERUSER_PASSWORD  (default: generated)
#
# The created instance id is saved to infrastructure/catalogue/.instance-id so
# status/bump/delete default to it when no id is given.

set -euo pipefail

fail() { echo "error: $*" >&2; exit 1; }
info() { echo "==> $*"; }
need() { command -v "$1" >/dev/null 2>&1 || fail "'$1' is required but not installed."; }

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "$SCRIPT_DIR/../.." && pwd)"
ENV_FILE="${ENV_FILE:-$SCRIPT_DIR/catalogue.env}"
ID_FILE="$SCRIPT_DIR/.instance-id"
PROVIDER_FILE_PATH="$REPO_ROOT/${PROVIDER_FILE:-provider.yml}"
TMP_DIR="$(mktemp -d)"; trap 'rm -rf "$TMP_DIR"' EXIT

need curl; need jq; need node

# --- env + preflight ------------------------------------------------------
[ -f "$ENV_FILE" ] || fail "env file not found at '$ENV_FILE'. Copy catalogue.env.example to catalogue.env."
set -a; # shellcheck disable=SC1090
source "$ENV_FILE"; set +a
CS_API="${CS_API:-https://cloud.codesphere.com/api}"; CS_API="${CS_API%/}"
[ -n "${CS_TOKEN:-}" ] || fail "CS_TOKEN is empty in '$ENV_FILE'."

api() { # api METHOD PATH [json-body-file]
  local method="$1" path="$2" body="${3:-}"
  local args=(-sS -o "$TMP_DIR/resp.json" -w '%{http_code}' -X "$method"
    -H "Authorization: Bearer $CS_TOKEN" -H 'Content-Type: application/json'
    "$CS_API$path")
  [ -n "$body" ] && args+=(-d "@$body")
  curl "${args[@]}"
}

read_provider_field() {
  node --input-type=module <<NODE
import { readFileSync } from "node:fs";
import { parse } from "yaml";
const d = parse(readFileSync("$PROVIDER_FILE_PATH","utf8"));
process.stdout.write(String(d["$1"] ?? ""));
NODE
}

PROVIDER_NAME="$(read_provider_field name)"
PROVIDER_SCHEMA="$(read_provider_field schemaVersion)"
[ -n "$PROVIDER_NAME" ] && [ -n "$PROVIDER_SCHEMA" ] || fail "could not read provider name/schemaVersion from $PROVIDER_FILE_PATH."

default_team() { printf '%s' "${CS_TEAM_IDS:-}" | cut -d, -f1 | tr -d ' '; }

# --- commands -------------------------------------------------------------
create() {
  local team="${INSTANCE_TEAM_ID:-$(default_team)}"
  [ -n "$team" ] || fail "no team to deploy into. Set INSTANCE_TEAM_ID or CS_TEAM_IDS."
  local name="${INSTANCE_NAME:-Mitteilungsdienst Demo}"
  local tenant="${INSTANCE_TENANT:-Musterstadt}"
  local version="${INSTANCE_VERSION:-1.0.0}"
  local pw="${POSTGRES_PASSWORD:-$(openssl rand -base64 24)}"
  local supw="${POSTGRES_SUPERUSER_PASSWORD:-$(openssl rand -base64 24)}"

  local body="$TMP_DIR/create.json"
  jq -n \
    --arg pname "$PROVIDER_NAME" --arg pschema "$PROVIDER_SCHEMA" \
    --arg name "$name" --arg tenant "$tenant" --arg version "$version" \
    --arg pw "$pw" --arg supw "$supw" --argjson team "$team" \
    '{ provider: { name: $pname, schemaVersion: $pschema },
       name: $name, teamId: $team, version: $version,
       plan: { id: 0, parameters: {} },
       config: { TENANT_NAME: $tenant },
       secrets: { POSTGRES_PASSWORD: $pw, POSTGRES_SUPERUSER_PASSWORD: $supw } }' >"$body"

  info "Deploying '$name' (version $version, tenant '$tenant') into team $team ..."
  local code; code=$(api POST /managed-services "$body")
  case "$code" in
    200|201)
      local id; id=$(jq -r '.id' "$TMP_DIR/resp.json")
      printf '%s' "$id" >"$ID_FILE"
      info "Created instance id=$id (saved to $(basename "$ID_FILE"))."
      jq '{id, name, provider, version:(.version // "?")}' "$TMP_DIR/resp.json" ;;
    *) cat "$TMP_DIR/resp.json" >&2; fail "create rejected (HTTP $code)." ;;
  esac
}

resolve_id() { local id="${1:-}"; [ -z "$id" ] && [ -f "$ID_FILE" ] && id="$(cat "$ID_FILE")"; printf '%s' "$id"; }

status() {
  local id; id="$(resolve_id "${1:-}")"; [ -n "$id" ] || fail "no instance id (pass one or run create first)."
  local code; code=$(api GET "/managed-services/$id")
  [ "$code" = "200" ] || { cat "$TMP_DIR/resp.json" >&2; fail "status HTTP $code"; }
  jq '{id, name, version:(.version // .provider.version // "?"), state:(.state // .status // "?"), hostname:(.details.hostname // .hostname // "?")}' "$TMP_DIR/resp.json" 2>/dev/null \
    || cat "$TMP_DIR/resp.json"
}

list() {
  local team="${INSTANCE_TEAM_ID:-$(default_team)}"
  local code; code=$(api GET "/managed-services?teamId=$team")
  [ "$code" = "200" ] || { cat "$TMP_DIR/resp.json" >&2; fail "list HTTP $code"; }
  echo "--- instances in team $team ---"
  jq -r 'if type=="array" then (.[] | "\(.id)\t\(.name)\t\(.version // "?")\t\(.state // .status // "?")") else tostring end' "$TMP_DIR/resp.json"
}

bump() {
  local id ver; id="$(resolve_id "${1:-}")"; ver="${2:-}"
  [ -n "$id" ]  || fail "no instance id (pass one or run create first)."
  [ -n "$ver" ] || fail "usage: instance.sh bump <id> <version>   (e.g. 1.1.0)"
  local body="$TMP_DIR/bump.json"; jq -n --arg v "$ver" '{ version: $v }' >"$body"
  info "Bumping instance $id to version $ver ..."
  local code; code=$(api PATCH "/managed-services/$id" "$body")
  case "$code" in
    200|202) info "Version change accepted (HTTP $code)."; jq '{id, version:(.version // "?")}' "$TMP_DIR/resp.json" 2>/dev/null || true ;;
    *) cat "$TMP_DIR/resp.json" >&2; fail "bump rejected (HTTP $code)." ;;
  esac
}

delete() {
  local id; id="$(resolve_id "${1:-}")"; [ -n "$id" ] || fail "no instance id."
  info "Deleting instance $id ..."
  local code; code=$(api DELETE "/managed-services/$id")
  case "$code" in 200|204) info "Deleted (HTTP $code)."; rm -f "$ID_FILE" ;; 404) info "Already absent (404)." ;; *) cat "$TMP_DIR/resp.json" >&2; fail "delete HTTP $code" ;; esac
}

cmd="${1:-}"; shift || true
case "$cmd" in
  create) create "$@" ;;
  list)   list "$@" ;;
  status) status "$@" ;;
  bump)   bump "$@" ;;
  delete) delete "$@" ;;
  *) fail "usage: instance.sh <create|list|status|bump|delete> [args]" ;;
esac
