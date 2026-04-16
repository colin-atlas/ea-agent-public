---
name: inbox-triage
description: "Scan [EXECUTIVE_FIRST_NAME]'s inbox, classify emails into the label system, auto-apply labels via Google API, and log results for Morning Briefing and EOD Report to reference."
---

# Inbox Triage

## Write Contract

| Output | Target | When |
|--------|--------|------|
| **Primary:** Triage log | `inbox-triage/YYYY-MM-DD-[am|pm].md` | Every run |
| **Secondary:** Pattern capture | `memory/patterns.md` (append) | Only when 2+ runs show same pattern |
| **External:** Label application | Gmail labels via Google API | High/Medium confidence emails |

**Naming:** Log file: `YYYY-MM-DD-[am|pm].md`. Pattern entry: `## [YYYY-MM-DD] Email pattern: {description}`.
**Skip write when:** Inbox clean and 0-Needs-Attention empty — write one line log only. No pattern entry.

---

## Before you begin
Read these files for context:
- MEMORY.md (current priorities and routing)
- brain/knowledge/ea.md (EA delegation rules — affects triage decisions)

Automated triage of [EXECUTIVE_FIRST_NAME]'s Gmail inbox. Runs twice daily. Classifies emails, auto-applies labels, and writes a log file for downstream skills to read.

**This skill does not send a DM.** Results are consumed by Morning Briefing and EOD Report via the log file.

---

## Setup

- **Read emails:** `scripts/google-api.sh --all gmail-triage-scan` (gmail.modify) — aggregates across all connected Google accounts. Each message includes `_account_email` to identify its source.
- **Add label:** `scripts/google-api.sh --account <email> gmail-add-label <message_id> <label_id>` — use the `_account_email` from the message
- **Remove label:** `scripts/google-api.sh --account <email> gmail-remove-label <message_id> <label_id>`
- **Add + remove in one call:** `scripts/google-api.sh --account <email> gmail-modify-labels <message_id> <add_label_id> <remove_label_id>`
- **Label rules:** `skills/inbox-triage/references/triage-rules.md`
- **Output log:** `inbox-triage/YYYY-MM-DD-[am|pm].md`

---

## Workflow

### Step 0: Determine run slot

```bash
HOUR=$(TZ="[CLIENT_TIMEZONE]" date +%H)
SLOT=$( [ "$HOUR" -lt 12 ] && echo "am" || echo "pm" )
DATE=$(TZ="[CLIENT_TIMEZONE]" date +%Y-%m-%d)
LOG_FILE="inbox-triage/${DATE}-${SLOT}.md"
```

### Step 1: Scan inbox

Fetch recent emails:
```bash
bash scripts/google-api.sh --all gmail-triage-scan 24 40
```

This returns emails from the last 24 hours with: `id`, `snippet`, `labelIds`, `_account_email`, and headers `From`, `Subject`, `Date`. Each message includes `_account_email` identifying which Google account it belongs to — use this value with `--account` when applying labels.

Also fetch emails currently labeled `0-Needs Attention` for re-evaluation:
```bash
bash scripts/google-api.sh --all gmail "label:0-Needs-Attention" 20
```

Parse the response. For each email, extract:
- `messageId` — the `id` field
- `from` — `From` header value
- `subject` — `Subject` header value
- `snippet` — top-level `snippet` field
- `labelIds` — array of current label IDs

**Filter already-triaged:** An email is already triaged if its `labelIds` contains any of the 10 label IDs from `references/triage-rules.md`. Skip these unless they are `0-Needs Attention` (re-evaluate those).

Report counts before proceeding:
- N total fetched
- N to triage (untriaged)
- N already labeled (skipping)
- N existing `0-Needs Attention` to re-evaluate

If untriaged = 0 and 0-Needs-Attention = 0, write log as "clean" and stop.

### Step 2: Classify

Read `skills/inbox-triage/references/triage-rules.md` for full rules.

For each untriaged email, determine:
1. **Label** — which of the 10 labels to assign
2. **Confidence** — High / Medium / Low
3. **Reason** — one-line justification

Classification order:
1. Deterministic rules (pattern match sender/subject) -> High confidence
2. Judgment-based rules (evaluate content) -> Medium confidence
3. Ambiguous -> `3-Delegated`, Low confidence

For existing `0-Needs Attention` re-evaluation:
- Still needs [EXECUTIVE_FIRST_NAME] -> keep, no label change
- No longer needs [EXECUTIVE_FIRST_NAME] -> reassign to most fitting label

### Step 3: Apply labels via Google API

**Auto-apply High and Medium confidence classifications.**
**Low confidence -> assign `3-Delegated` regardless of original classification.**

For each email to label:
```bash
bash scripts/google-api.sh --account [ACCOUNT_EMAIL] gmail-add-label [MESSAGE_ID] [LABEL_ID]
```

For `0-Needs Attention` removals (re-evaluated as no longer needed):
```bash
bash scripts/google-api.sh --account [ACCOUNT_EMAIL] gmail-remove-label [MESSAGE_ID] Label_3291938398857867514
```

For re-evaluated emails that need a new label AND `0-Needs Attention` removed:
```bash
bash scripts/google-api.sh --account [ACCOUNT_EMAIL] gmail-modify-labels [MESSAGE_ID] [NEW_LABEL_ID] Label_3291938398857867514
```

**Use the label IDs from `references/triage-rules.md`**, not label names.

Process one at a time. Track successes and failures.

### Step 4: Write log

Write results to `inbox-triage/YYYY-MM-DD-[am|pm].md` in this format:

```markdown
# Inbox Triage — [DATE] [AM|PM]
Run: [TIMESTAMP] | Slot: [am|pm] | Emails scanned: N

## Summary
- Triaged: N
- Needs Attention: N (new: N, kept: N)
- Delegated (low confidence): N
- Already labeled (skipped): N
- 0-Needs Attention removed: N
- Errors: N

## Needs Attention
<!-- List only if count > 0 -->
- [From] — [Subject] — [Reason]
- [From] — [Subject] — [Reason]

## Full Triage Log
| From | Subject | Label | Confidence | Reason |
|---|---|---|---|---|
| ... | ... | ... | H/M/L | ... |

## Errors
<!-- Only if errors occurred -->
- [messageId] — [subject] — [error]
```

The `## Needs Attention` section is what Morning Briefing and EOD read. Keep it concise — one line per email.

### Step 5: Feed back into knowledge graph

After writing the log, check for patterns worth capturing in `memory/patterns.md`.

**When to write a pattern** (only if you notice something recurring across 2+ triage runs):
- A sender/domain that consistently maps to the same label
- A new email pattern that the deterministic rules don't cover yet
- A classification that keeps getting overridden by [EXECUTIVE_FIRST_NAME] (check past logs)
- Volume spikes from a specific source

**Skip this step** if nothing notable was observed — don't log noise.

---

## Error Handling

- **Google API error (403/401):** Log "Gmail modify access unavailable — labels not applied" in errors section. Still write the classification log (useful for Morning Briefing/EOD even without applied labels). May indicate token needs re-auth — see `scripts/google-reauth.sh`.
- **Label application fails:** Note failure, continue with remaining emails. List in Errors section.
- **0 emails found:** Write log: "Inbox clean — nothing to triage."
- **Large volume (30+):** Process all, but note volume in summary.
