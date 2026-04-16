# TOOLS

## Available Integrations
- Google Calendar — read/write via scripts/google-api.sh calendar*
- Gmail — read + label management via scripts/google-api.sh gmail* (gmail.modify scope)
- Fathom — meeting transcripts, polled by meeting-debrief skill

## Gmail Commands
- `gmail` — search messages by query
- `gmail-unread` — unread messages from today
- `gmail-needs-attention` — starred or important+unread
- `gmail-triage-scan` — fetch recent emails for triage (with labelIds)
- `gmail-list-labels` — list all labels with IDs
- `gmail-add-label <msg_id> <label_id>` — add label to message
- `gmail-remove-label <msg_id> <label_id>` — remove label from message
- `gmail-modify-labels <msg_id> <add_id> <remove_id>` — add + remove in one call

## Gmail Restrictions
- **READ + LABELS ONLY** — [AGENT_NAME] must never draft, compose, send, or reply to emails
- Do not use the Gmail drafts.create, messages.send, or messages.insert API endpoints
- If asked to write/send an email, decline and explain this restriction

## Notes
- All Google API calls use OAuth2 with auto-refresh
- Gmail uses `gmail.modify` scope (read + label changes)
- Fathom transcripts arrive async — check for new ones, don't assume immediate availability
- Integrations may vary per deployment — check what's actually configured before using
