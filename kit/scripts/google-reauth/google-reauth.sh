#!/bin/bash
# Google OAuth re-auth helper (v2 — uses intake app callback)
#
# Generates a client-facing auth link and retrieves tokens after authorization.
# No more localhost redirects or copy-pasting URLs.
#
# Usage:
#   Step 1: Generate link to send to client
#     bash google-reauth.sh url <client-name>
#
#   Step 2: After client authorizes (check for success), fetch tokens
#     bash google-reauth.sh fetch <client-name>
#
#   Step 3: Write tokens to a client container
#     bash google-reauth.sh write <client-dir> <refresh-token> <email> <scopes-json>
#
# Requires env vars:
#   ATLAS_GOOGLE_CLIENT_ID       — GCP OAuth client ID
#   ATLAS_GOOGLE_CLIENT_SECRET   — GCP OAuth client secret
#   ATLAS_INTAKE_APP_URL         — Intake app URL (e.g., https://intake.example.com)

set -euo pipefail

# --- Defaults ---
CLIENT_ID="${ATLAS_GOOGLE_CLIENT_ID:-}"
CLIENT_SECRET="${ATLAS_GOOGLE_CLIENT_SECRET:-}"
INTAKE_URL="${ATLAS_INTAKE_APP_URL:-}"

usage() {
  echo "Usage:"
  echo "  $0 url <client-name>                          — Generate auth link for client"
  echo "  $0 fetch <client-name>                        — Fetch tokens after client authorizes"
  echo "  $0 write <client-dir> <refresh-token> <email> '[\"scope1\",\"scope2\"]'"
  echo ""
  echo "Environment:"
  echo "  ATLAS_GOOGLE_CLIENT_ID       — GCP OAuth client ID"
  echo "  ATLAS_GOOGLE_CLIENT_SECRET   — GCP OAuth client secret"
  echo "  ATLAS_INTAKE_APP_URL         — Intake app URL (e.g., https://intake.example.com)"
  exit 1
}

# --- Command: url ---
cmd_url() {
  local client_name="$1"

  if [ -z "$INTAKE_URL" ]; then
    echo "ERROR: ATLAS_INTAKE_APP_URL not set" >&2
    exit 1
  fi

  local url="${INTAKE_URL}/api/google/reauth?client=${client_name}"

  echo ""
  echo "=== Google OAuth Re-Auth Link ==="
  echo ""
  echo "Send this to the client:"
  echo ""
  echo "  $url"
  echo ""
  echo "After they click and authorize, they'll see a success page."
  echo "Then run:"
  echo "  $0 fetch \"$client_name\""
  echo ""
}

# --- Command: fetch ---
cmd_fetch() {
  local client_name="$1"

  if [ -z "$INTAKE_URL" ] || [ -z "$CLIENT_SECRET" ]; then
    echo "ERROR: ATLAS_INTAKE_APP_URL and ATLAS_GOOGLE_CLIENT_SECRET must be set" >&2
    exit 1
  fi

  echo "Fetching tokens for client: $client_name ..."

  local response
  response=$(curl -s -w "\n%{http_code}" \
    -H "Authorization: Bearer $CLIENT_SECRET" \
    "${INTAKE_URL}/api/google/reauth/tokens?client=${client_name}")

  local http_code
  http_code=$(echo "$response" | tail -1)
  local body
  body=$(echo "$response" | sed '$d')

  if [ "$http_code" = "404" ]; then
    echo ""
    echo "No pending tokens for '$client_name'."
    echo "Has the client completed the auth flow yet?"
    exit 1
  fi

  if [ "$http_code" != "200" ]; then
    echo "ERROR: API returned $http_code" >&2
    echo "$body" >&2
    exit 1
  fi

  local refresh_token email scopes_json
  refresh_token=$(echo "$body" | jq -r '.refresh_token')
  email=$(echo "$body" | jq -r '.email')
  scopes_json=$(echo "$body" | jq -c '.scopes')

  echo ""
  echo "=== Tokens Retrieved ==="
  echo ""
  echo "Email:         $email"
  echo "Refresh Token: $refresh_token"
  echo "Scopes:        $scopes_json"
  echo ""
  echo "To write credentials to a client container, run:"
  echo "  $0 write <client-dir> \"$refresh_token\" \"$email\" '$scopes_json'"
  echo ""
}

# --- Command: write ---
cmd_write() {
  local client_dir="$1"
  local refresh_token="$2"
  local email="$3"
  local scopes_json="$4"

  if [ -z "$CLIENT_ID" ] || [ -z "$CLIENT_SECRET" ]; then
    echo "ERROR: ATLAS_GOOGLE_CLIENT_ID and ATLAS_GOOGLE_CLIENT_SECRET must be set" >&2
    exit 1
  fi

  if [ ! -d "$client_dir" ]; then
    echo "ERROR: Client directory not found: $client_dir" >&2
    exit 1
  fi

  local secrets_dir="$client_dir/openclaw-home/.openclaw/secrets"
  mkdir -p "$secrets_dir"

  # Write credentials file (Atlas GCP client)
  jq -n --arg cid "$CLIENT_ID" --arg csec "$CLIENT_SECRET" \
    '{ installed: { client_id: $cid, client_secret: $csec } }' \
    > "$secrets_dir/google-credentials.json"

  # Write tokens file (client's refresh token)
  jq -n --arg rt "$refresh_token" --arg email "$email" --argjson scopes "$scopes_json" \
    '{ refresh_token: $rt, access_token: "", email: $email, scopes: $scopes }' \
    > "$secrets_dir/google-tokens.json"

  chmod 600 "$secrets_dir/google-credentials.json" "$secrets_dir/google-tokens.json"

  echo ""
  echo "=== Credentials Written ==="
  echo ""
  echo "  $secrets_dir/google-credentials.json"
  echo "  $secrets_dir/google-tokens.json"
  echo ""
  echo "Restart the container to pick up the new credentials:"
  echo "  cd $client_dir && sg docker -c \"docker compose restart openclaw-gateway\""
  echo ""
}

# --- Main ---
if [ $# -lt 1 ]; then
  usage
fi

CMD="$1"
shift

case "$CMD" in
  url)
    [ $# -lt 1 ] && usage
    cmd_url "$1"
    ;;
  fetch)
    [ $# -lt 1 ] && usage
    cmd_fetch "$1"
    ;;
  write)
    [ $# -lt 4 ] && usage
    cmd_write "$1" "$2" "$3" "$4"
    ;;
  *)
    usage
    ;;
esac
