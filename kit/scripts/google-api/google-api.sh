#!/bin/bash
# Google API helper — handles token refresh and API calls
# Supports multiple Google accounts via accounts array in google-tokens.json
#
# Usage: google-api.sh [--all | --account <id>] <command> [args]
#
# Flags (before command):
#   --all            Aggregate results across all accounts (read commands only)
#   --account <id>   Use a specific account by id or email (default: first account)
#
# Without flags, uses the first (primary) account — backwards compatible.

set -euo pipefail

SECRETS_DIR="$HOME/.openclaw/secrets"
CREDS_FILE="$SECRETS_DIR/google-credentials.json"
TOKENS_FILE="$SECRETS_DIR/google-tokens.json"

# Read OAuth client credentials (shared across all accounts)
CLIENT_ID=$(jq -r '.installed.client_id' "$CREDS_FILE")
CLIENT_SECRET=$(jq -r '.installed.client_secret' "$CREDS_FILE")

# --- Multi-account token handling ---

# Detect token format: new (accounts array) vs legacy (flat object)
if jq -e '.accounts' "$TOKENS_FILE" >/dev/null 2>&1; then
  ACCOUNT_COUNT=$(jq '.accounts | length' "$TOKENS_FILE")
else
  # Legacy format — treat as single account
  ACCOUNT_COUNT=1
fi

# Get account data by index (0-based). Handles both formats.
get_account_field() {
  local idx="$1" field="$2"
  if jq -e '.accounts' "$TOKENS_FILE" >/dev/null 2>&1; then
    jq -r ".accounts[$idx].$field" "$TOKENS_FILE"
  else
    # Legacy flat format
    jq -r ".$field" "$TOKENS_FILE"
  fi
}

# Get account index by id or email. Returns 0-based index or -1 if not found.
find_account_index() {
  local needle="$1"
  if jq -e '.accounts' "$TOKENS_FILE" >/dev/null 2>&1; then
    jq -r --arg n "$needle" '
      .accounts | to_entries[]
      | select(.value.id == $n or .value.email == $n)
      | .key' "$TOKENS_FILE" | head -1
  else
    # Legacy format — only index 0 exists
    echo "0"
  fi
}

# Refresh access token for a specific account index
refresh_token_for() {
  local idx="$1"
  local rt
  rt=$(get_account_field "$idx" "refresh_token")

  local response
  response=$(curl -s -X POST https://oauth2.googleapis.com/token \
    -d "client_id=$CLIENT_ID" \
    -d "client_secret=$CLIENT_SECRET" \
    -d "refresh_token=$rt" \
    -d "grant_type=refresh_token")

  local new_token
  new_token=$(echo "$response" | jq -r '.access_token')
  if [ "$new_token" = "null" ] || [ -z "$new_token" ]; then
    local email
    email=$(get_account_field "$idx" "email")
    echo "ERROR: Token refresh failed for account $email" >&2
    echo "$response" >&2
    return 1
  fi

  # Update stored access token
  if jq -e '.accounts' "$TOKENS_FILE" >/dev/null 2>&1; then
    jq --argjson i "$idx" --arg token "$new_token" \
      '.accounts[$i].access_token = $token' "$TOKENS_FILE" > "$TOKENS_FILE.tmp" \
      && mv "$TOKENS_FILE.tmp" "$TOKENS_FILE"
  else
    jq --arg token "$new_token" '.access_token = $token' "$TOKENS_FILE" > "$TOKENS_FILE.tmp" \
      && mv "$TOKENS_FILE.tmp" "$TOKENS_FILE"
  fi
  chmod 600 "$TOKENS_FILE"

  echo "$new_token"
}

# --- Parse flags ---

MODE="single"     # single | all
ACCOUNT_IDX=0     # default to first account

while [[ "${1:-}" == --* ]]; do
  case "$1" in
    --all)
      MODE="all"
      shift
      ;;
    --account)
      shift
      local_id="${1:?--account requires an id or email}"
      found=$(find_account_index "$local_id")
      if [ -z "$found" ] || [ "$found" = "" ]; then
        echo "ERROR: Account '$local_id' not found" >&2
        exit 1
      fi
      ACCOUNT_IDX=$found
      shift
      ;;
    *)
      echo "ERROR: Unknown flag: $1" >&2
      exit 1
      ;;
  esac
done

COMMAND="${1:-}"
shift || true

# --- Helper: build account indices list based on mode ---
if [ "$MODE" = "all" ]; then
  INDICES=$(seq 0 $((ACCOUNT_COUNT - 1)))
else
  INDICES="$ACCOUNT_IDX"
fi

# --- Helper: run a calendar query for one account, inject _account fields ---
calendar_query_one() {
  local idx="$1" token="$2" params="$3"
  local email
  email=$(get_account_field "$idx" "email")
  local result
  result=$(curl -s "https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}" \
    -H "Authorization: Bearer $token")
  # Inject _account_email into each event item
  echo "$result" | jq --arg email "$email" '
    if .items then .items |= map(. + {"_account_email": $email}) else . end'
}

# --- Helper: merge calendar results from multiple accounts ---
calendar_query_all() {
  local params="$1"
  local merged_items="[]"
  local last_result=""

  for idx in $INDICES; do
    local token
    token=$(refresh_token_for "$idx") || continue
    local result
    result=$(calendar_query_one "$idx" "$token" "$params")
    local items
    items=$(echo "$result" | jq '.items // []')
    merged_items=$(echo "$merged_items" "$items" | jq -s '.[0] + .[1]')
    last_result="$result"
  done

  # Sort merged items by start time
  merged_items=$(echo "$merged_items" | jq 'sort_by(.start.dateTime // .start.date)')

  # Return in same structure as single-account response, with merged items
  echo "$last_result" | jq --argjson items "$merged_items" '.items = $items'
}

# --- Helper: gmail query for one account, inject _account fields ---
gmail_fetch_messages_one() {
  local idx="$1" token="$2" query="$3" max="$4" extra_headers="${5:-}"
  local email
  email=$(get_account_field "$idx" "email")

  local query_enc
  query_enc=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$query'))")

  local messages
  messages=$(curl -s "https://www.googleapis.com/gmail/v1/users/me/messages?maxResults=$max&q=$query_enc" \
    -H "Authorization: Bearer $token")

  local ids
  ids=$(echo "$messages" | jq -r '.messages[]?.id // empty')
  local total
  total=$(echo "$messages" | jq -r '.resultSizeEstimate // 0')

  if [ -z "$ids" ]; then
    echo "{\"total\": 0, \"messages\": [], \"_account_email\": \"$email\"}"
    return
  fi

  local header_params="metadataHeaders=From&metadataHeaders=Subject&metadataHeaders=Date"
  if [ -n "$extra_headers" ]; then
    header_params="$header_params&$extra_headers"
  fi

  local msg_array="["
  local first=true
  for id in $ids; do
    if [ "$first" = true ]; then first=false; else msg_array+=","; fi
    local msg
    msg=$(curl -s "https://www.googleapis.com/gmail/v1/users/me/messages/$id?format=metadata&$header_params" \
      -H "Authorization: Bearer $token")
    # Inject account email into each message
    msg=$(echo "$msg" | jq --arg email "$email" '. + {"_account_email": $email}')
    msg_array+="$msg"
  done
  msg_array+="]"

  echo "{\"total\": $total, \"_account_email\": \"$email\", \"messages\": $msg_array}"
}

# --- Helper: merge gmail results from multiple accounts ---
gmail_query_all() {
  local query="$1" max="$2" extra_headers="${3:-}"
  local all_messages="[]"
  local total_sum=0

  for idx in $INDICES; do
    local token
    token=$(refresh_token_for "$idx") || continue
    local result
    result=$(gmail_fetch_messages_one "$idx" "$token" "$query" "$max" "$extra_headers")
    local msgs
    msgs=$(echo "$result" | jq '.messages // []')
    local t
    t=$(echo "$result" | jq '.total // 0')
    all_messages=$(echo "$all_messages" "$msgs" | jq -s '.[0] + .[1]')
    total_sum=$((total_sum + t))
  done

  echo "{\"total\": $total_sum, \"messages\": $all_messages}"
}

# --- Commands ---

case "$COMMAND" in
  calendar)
    TODAY=$(date -u +%Y-%m-%dT00:00:00Z)
    TOMORROW=$(date -u -d "+1 day" +%Y-%m-%dT00:00:00Z)
    PARAMS="timeMin=$TODAY&timeMax=$TOMORROW&singleEvents=true&orderBy=startTime"
    if [ "$MODE" = "all" ]; then
      calendar_query_all "$PARAMS"
    else
      TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
      calendar_query_one "$ACCOUNT_IDX" "$TOKEN" "$PARAMS"
    fi
    ;;

  calendar-today)
    TODAY=$(TZ="${AGENT_TIMEZONE:-America/New_York}" date +%Y-%m-%d)
    START="${TODAY}T00:00:00"
    END="${TODAY}T23:59:59"
    TZ_OFFSET=$(TZ="${AGENT_TIMEZONE:-America/New_York}" date +%z | sed 's/\(..\)$/:\1/')
    START_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${START}${TZ_OFFSET}'))")
    END_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${END}${TZ_OFFSET}'))")
    PARAMS="timeMin=$START_ENC&timeMax=$END_ENC&singleEvents=true&orderBy=startTime&maxResults=50"
    if [ "$MODE" = "all" ]; then
      calendar_query_all "$PARAMS"
    else
      TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
      calendar_query_one "$ACCOUNT_IDX" "$TOKEN" "$PARAMS"
    fi
    ;;

  calendar-tomorrow)
    TOMORROW=$(TZ="${AGENT_TIMEZONE:-America/New_York}" date -d "+1 day" +%Y-%m-%d)
    START="${TOMORROW}T00:00:00"
    END="${TOMORROW}T23:59:59"
    TZ_OFFSET=$(TZ="${AGENT_TIMEZONE:-America/New_York}" date +%z | sed 's/\(..\)$/:\1/')
    START_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${START}${TZ_OFFSET}'))")
    END_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('${END}${TZ_OFFSET}'))")
    PARAMS="timeMin=$START_ENC&timeMax=$END_ENC&singleEvents=true&orderBy=startTime&maxResults=50"
    if [ "$MODE" = "all" ]; then
      calendar_query_all "$PARAMS"
    else
      TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
      calendar_query_one "$ACCOUNT_IDX" "$TOKEN" "$PARAMS"
    fi
    ;;

  calendar-range)
    START="${1:-$(date -u +%Y-%m-%dT00:00:00Z)}"
    END="${2:-$(date -u -d '+7 days' +%Y-%m-%dT00:00:00Z)}"
    START_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$START'))")
    END_ENC=$(python3 -c "import urllib.parse; print(urllib.parse.quote('$END'))")
    PARAMS="timeMin=$START_ENC&timeMax=$END_ENC&singleEvents=true&orderBy=startTime&maxResults=100"
    if [ "$MODE" = "all" ]; then
      calendar_query_all "$PARAMS"
    else
      TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
      calendar_query_one "$ACCOUNT_IDX" "$TOKEN" "$PARAMS"
    fi
    ;;

  calendar-create)
    # Write operations always use a single account
    if [ "$MODE" = "all" ]; then
      echo "ERROR: calendar-create requires --account <id>, cannot use --all" >&2
      exit 1
    fi
    TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
    BODY="$1"
    curl -s "https://www.googleapis.com/calendar/v3/calendars/primary/events" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$BODY"
    ;;

  gmail)
    QUERY="${1:-is:unread}"
    MAX="${2:-10}"
    if [ "$MODE" = "all" ]; then
      gmail_query_all "$QUERY" "$MAX"
    else
      TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
      gmail_fetch_messages_one "$ACCOUNT_IDX" "$TOKEN" "$QUERY" "$MAX"
    fi
    ;;

  gmail-unread)
    TODAY=$(TZ="${AGENT_TIMEZONE:-America/New_York}" date +%Y/%m/%d)
    QUERY="is:unread after:$TODAY"
    MAX="${1:-15}"
    if [ "$MODE" = "all" ]; then
      gmail_query_all "$QUERY" "$MAX" "metadataHeaders=To"
    else
      TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
      gmail_fetch_messages_one "$ACCOUNT_IDX" "$TOKEN" "$QUERY" "$MAX" "metadataHeaders=To"
    fi
    ;;

  gmail-needs-attention)
    QUERY="${1:-is:starred OR (is:important is:unread)}"
    MAX="${2:-10}"
    if [ "$MODE" = "all" ]; then
      gmail_query_all "$QUERY" "$MAX"
    else
      TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
      gmail_fetch_messages_one "$ACCOUNT_IDX" "$TOKEN" "$QUERY" "$MAX"
    fi
    ;;

  gmail-triage-scan)
    HOURS="${1:-24}"
    MAX="${2:-40}"
    QUERY="newer_than:${HOURS}h"
    if [ "$MODE" = "all" ]; then
      gmail_query_all "$QUERY" "$MAX" "metadataHeaders=To"
    else
      TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
      gmail_fetch_messages_one "$ACCOUNT_IDX" "$TOKEN" "$QUERY" "$MAX" "metadataHeaders=To"
    fi
    ;;

  gmail-list-labels)
    # Labels are per-account; with --all, return labeled by account
    if [ "$MODE" = "all" ]; then
      echo "["
      FIRST_ACCT=true
      for idx in $INDICES; do
        local_token=$(refresh_token_for "$idx") || continue
        local_email=$(get_account_field "$idx" "email")
        if [ "$FIRST_ACCT" = true ]; then FIRST_ACCT=false; else echo ","; fi
        curl -s "https://www.googleapis.com/gmail/v1/users/me/labels" \
          -H "Authorization: Bearer $local_token" \
          | jq --arg email "$local_email" '{account: $email, labels: [.labels[] | {id, name, type}]}'
      done
      echo "]"
    else
      TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
      curl -s "https://www.googleapis.com/gmail/v1/users/me/labels" \
        -H "Authorization: Bearer $TOKEN" | jq '[.labels[] | {id, name, type}]'
    fi
    ;;

  gmail-add-label)
    # Write operation — single account only
    if [ "$MODE" = "all" ]; then
      echo "ERROR: gmail-add-label requires --account <id>, cannot use --all" >&2
      exit 1
    fi
    TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
    MSG_ID="$1"
    shift
    LABEL_JSON=$(printf '%s\n' "$@" | jq -R . | jq -s '.')
    BODY=$(jq -n --argjson ids "$LABEL_JSON" '{"addLabelIds": $ids}')
    curl -s -X POST "https://www.googleapis.com/gmail/v1/users/me/messages/$MSG_ID/modify" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$BODY"
    ;;

  gmail-remove-label)
    if [ "$MODE" = "all" ]; then
      echo "ERROR: gmail-remove-label requires --account <id>, cannot use --all" >&2
      exit 1
    fi
    TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
    MSG_ID="$1"
    shift
    LABEL_JSON=$(printf '%s\n' "$@" | jq -R . | jq -s '.')
    BODY=$(jq -n --argjson ids "$LABEL_JSON" '{"removeLabelIds": $ids}')
    curl -s -X POST "https://www.googleapis.com/gmail/v1/users/me/messages/$MSG_ID/modify" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$BODY"
    ;;

  gmail-modify-labels)
    if [ "$MODE" = "all" ]; then
      echo "ERROR: gmail-modify-labels requires --account <id>, cannot use --all" >&2
      exit 1
    fi
    TOKEN=$(refresh_token_for "$ACCOUNT_IDX")
    MSG_ID="$1"
    ADD_ID="$2"
    REMOVE_ID="${3:-}"
    BODY="{}"
    if [ -n "$ADD_ID" ] && [ -n "$REMOVE_ID" ]; then
      BODY=$(jq -n --arg add "$ADD_ID" --arg rm "$REMOVE_ID" '{"addLabelIds": [$add], "removeLabelIds": [$rm]}')
    elif [ -n "$ADD_ID" ]; then
      BODY=$(jq -n --arg add "$ADD_ID" '{"addLabelIds": [$add]}')
    elif [ -n "$REMOVE_ID" ]; then
      BODY=$(jq -n --arg rm "$REMOVE_ID" '{"removeLabelIds": [$rm]}')
    fi
    curl -s -X POST "https://www.googleapis.com/gmail/v1/users/me/messages/$MSG_ID/modify" \
      -H "Authorization: Bearer $TOKEN" \
      -H "Content-Type: application/json" \
      -d "$BODY"
    ;;

  accounts)
    # List configured accounts
    if jq -e '.accounts' "$TOKENS_FILE" >/dev/null 2>&1; then
      jq '[.accounts[] | {id, email, scopes}]' "$TOKENS_FILE"
    else
      jq '{id: "primary", email: .email, scopes: .scopes}' "$TOKENS_FILE" | jq '[.]'
    fi
    ;;

  *)
    echo "Usage: google-api.sh [--all | --account <id|email>] <command> [args]"
    echo ""
    echo "Commands:"
    echo "  accounts                          List configured Google accounts"
    echo "  calendar                          Today's events (UTC)"
    echo "  calendar-today                    Today's events (local timezone)"
    echo "  calendar-tomorrow                 Tomorrow's events"
    echo "  calendar-range <start> <end>      Events in date range"
    echo "  calendar-create '<json>'          Create event (single account)"
    echo "  gmail [query] [max]               Search messages"
    echo "  gmail-unread [max]                Unread messages from today"
    echo "  gmail-needs-attention [query] [max]  Starred/important messages"
    echo "  gmail-triage-scan [hours] [max]   Recent messages for triage"
    echo "  gmail-list-labels                 List Gmail labels"
    echo "  gmail-add-label <msg_id> <label>  Add label (single account)"
    echo "  gmail-remove-label <msg_id> <label>  Remove label (single account)"
    echo "  gmail-modify-labels <msg_id> <add> <remove>  Modify labels (single account)"
    echo ""
    echo "Flags:"
    echo "  --all              Aggregate across all accounts (read commands)"
    echo "  --account <id>     Target specific account by id or email"
    exit 1
    ;;
esac
