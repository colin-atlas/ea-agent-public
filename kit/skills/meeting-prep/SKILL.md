---
name: meeting-prep
<!-- IF_EA -->
description: "Create meeting prep briefs for upcoming meetings. Use when preparing [EXECUTIVE_FIRST_NAME]'s meetings, reviewing tomorrow's calendar, generating prep notes for [EA_FIRST_NAME], or when asked to 'meeting prep', 'prep my meetings', 'prep for tomorrow', or 'prep for today'."
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
description: "Create meeting prep briefs for upcoming meetings. Use when preparing [EXECUTIVE_FIRST_NAME]'s meetings, reviewing tomorrow's calendar, or when asked to 'meeting prep', 'prep my meetings', 'prep for tomorrow', or 'prep for today'."
<!-- END_IF_NO_EA -->
---

# Meeting Prep

Prepare upcoming meeting briefs by scanning the relevant calendar window, classifying each meeting, generating targeted prep notes, optionally creating prep blocks, and delivering the output to the configured recipient. Do not store full prep briefs by default; only save a durable prep artifact when the meeting is strategically important or when explicitly asked to save it.

---

## Write Contract

| Output | Target | When |
|--------|--------|------|
| **Primary:** Brief delivery | Configured delivery target | Each run with meetings |
| **Secondary:** Operational trace | `memory/YYYY-MM-DD.md` (append, minimal) | After all meetings are processed |
| **External:** Prep calendar blocks | Google Calendar (15-min events) | Each meeting or batch |
| **Optional durable artifact:** Saved prep brief | `brain/meetings/prep/YYYY-MM-DD.md` (append) | Only for strategic/high-stakes meetings or explicit save requests |

**Naming:** If a durable prep artifact is intentionally saved, use `YYYY-MM-DD.md` with section `## [Time] [Title] (type: [type])`.
**Skip write when:** No relevant meetings in the target window — send a brief "no meetings to prep" message to the configured recipient, do not save a prep artifact, and do not append a session-log entry. Skip already-prepped meetings (dedup by event ID or title+time).

---

## Before you begin

Read these files for context:
- `MEMORY.md` — current priorities and routing
- `brain/knowledge/team.md` — internal team role context
- `memory/people/` files as needed for attendees being prepped

Use the configured planning window. By default for the scheduled cron run, prepare **tomorrow's** meetings. For a manual user request such as "prep for today", use today's calendar instead.

## Step 1 — Pull the Relevant Calendar Window

```bash
# Scheduled run default
./scripts/google-api.sh --all calendar-tomorrow

# Manual same-day prep variant when explicitly requested
# ./scripts/google-api.sh --all calendar-today
```

Extract each event:
- Event ID (for dedup)
- Title / Summary
- Start time, end time
- Attendees (emails + names)
- Description / notes
- Location or video link

**Skip:**
- All-day events (no prep needed)
- Events titled "Meeting Prep" or "Prep:" (these are our prep blocks)
- Events already past (if running mid-day)

---

## Step 2 — Check for Existing Prep Signals

Avoid duplicating prep for the same meeting in the same planning window.

Use one of these lightweight checks:
- if a prep block already exists for the meeting window, treat that as a signal prep may already have been handled
- if a durable prep artifact was intentionally saved earlier for this same event, do not create another unless asked
- if the current run clearly already processed the event, skip it

If you need a file-based check for an intentionally saved durable prep artifact:

```bash
PREP_LOG="brain/meetings/prep/$(date +%Y-%m-%d).md"
```

If the event ID or event title + time already appears in an intentionally saved prep log, skip it.

---

## Step 3 — Classify Each Meeting

Classify using this priority order:

### 3a. Calendar naming conventions (highest priority)
- `[Client]` prefix -> **Client meeting**
- `[External]` prefix -> **External meeting**
- `[1:1]` prefix -> **Internal 1:1**
- `[Team]` prefix -> **Team meeting**

### 3b. Attendee matching (if no naming convention)
Check attendee emails against known sources:

**Internal (Team/1:1):**
Check `brain/knowledge/team.md` for team member names/emails.
Also check: `@[COMPANY_DOMAIN]` email domain.

If ALL attendees are internal:
- 2 people ([EXECUTIVE_FIRST_NAME] + 1) -> **Internal 1:1**
- 3+ people -> **Team meeting**

**Client:**
```bash
# For each non-internal attendee email, check Airtable if configured
./scripts/airtable-api.sh client-by-email "<attendee_email>"
```
If any attendee matches a client record -> **Client meeting**

**External (default):**
If attendees don't match internal or client -> **External meeting**

---

## Step 4 — Generate Prep Briefs

### 4a. Internal 1:1

```
**1:1 Prep: [Person Name]**
[Time]

**Context:**
- Role: [from memory/people/{name}.md or brain/knowledge/team.md]
- Last 1:1: [date + key topics from brain/meetings/debriefs/]
- Recent notes: [from memory/people/{name}.md — commitments, issues, decisions]

**Open Items:**
- [Tasks involving this person or their area]
- [Commitments made in past meetings]
- [Issues flagged in meeting debriefs]

**Suggested Topics:**
- [Based on recent activity, open items, patterns]
```

**Data sources:**

```bash
# Person context — read their people file
cat memory/people/[name].md
# Also check brain/knowledge/team.md for role context
```

```bash
# Recent meeting debriefs with this person
ls brain/meetings/debriefs/ | grep -i "[name]" | tail -5
```

```bash
# Tasks related to this person
sqlite3 db/tasks.db "SELECT id, title, status, notes FROM tasks WHERE owner LIKE '%[name]%' AND status NOT IN ('done', 'archive') ORDER BY priority;"
```

### 4b. Team Meeting

```
**Team Meeting Prep: [Meeting Name]**
[Time] | Attendees: [list]

**Agenda/Context:**
- [From calendar description if available]
- [Standing agenda items for recurring meetings]

**Updates to Share:**
- [Recent task completions relevant to this team]
- [Decisions made since last meeting]
- [Blockers to raise]

**People Context:**
- [Key notes for each attendee from memory/people/{name}.md]
```

### 4c. Client Meeting

```
**Client Prep: [Client Name] — [Company]**
[Time]

**Relationship Summary:**
- Stage: [from CRM if configured]
- Recent Updates: [last 3-5 notes]

**Past Meetings:**
[Last 2-3 meetings from brain/meetings/debriefs/ with key topics/decisions]

**Open Items:**
- [Commitments from memory/people/{name}.md]
- [Tasks related to this client]

**Talking Points:**
- [Based on status, recent updates, any issues to address]
```

### 4d. External Meeting (Prospect/Partner/Discovery)

```
**External Prep: [Person Name] — [Company]**
[Time]

**Who They Are:**
- Name: [full name]
- Role: [title at company]
- Company: [name + brief description]
- Background: [LinkedIn summary / professional background]
- Relevant context: [mutual connections, industry overlap, how they found us]

**Meeting Purpose:**
- [From calendar description or best guess]

**Suggested Approach:**
- [Key questions to ask]
- [Relevant offerings to discuss]
- [Any preparation needed]
```

**Data sources:**
```bash
# Web research on the person
# Use web_search for: "[person name] [company]"
```

---

## Step 5 — Create Prep Time Blocks

For each meeting (or batch of back-to-backs), create a 15-minute calendar event:

**Logic:**
1. Sort meetings by start time
2. Group back-to-back meetings (gap < 15 min between end of one and start of next)
3. For each group:
   - Single meeting: create 15-min block ending at meeting start
   - Back-to-back batch: create 15-min block ending at first meeting's start
4. Skip if a "Prep:" or "Meeting Prep" event already exists in that time slot

**Create the event:**
```bash
./scripts/google-api.sh calendar-create '{
  "summary": "Prep: [Meeting names]",
  "description": "Meeting prep briefs posted in DM",
  "start": {"dateTime": "[start_iso]", "timeZone": "[CLIENT_TIMEZONE]"},
  "end": {"dateTime": "[end_iso]", "timeZone": "[CLIENT_TIMEZONE]"},
  "reminders": {"useDefault": false, "overrides": [{"method": "popup", "minutes": 5}]}
}'
```

**Edge cases:**
- First meeting of the day starts before 7am -> skip prep block
- Meeting starts at day start (e.g., 8am, nothing before) -> create 7:45-8:00 block
- Prep block would overlap another meeting -> skip it, note in the brief

---

## Step 6 — Deliver to the Configured Recipient

Post all briefs to the configured delivery target. If the combined briefs are too long for one message (>3000 chars), split into multiple messages.

End with a short review prompt, for example: *"Flag anything that needs more research or adjustments."*

---

## Step 7 — Log minimally; save only when justified

### Default behavior
Do **not** save full prep briefs by default.

Instead, append only a light operational trace to the session log:
```
## Meeting Prep [HH:MM UTC]
**Meetings prepped:** [count]
- [Time] [Title] ([type])
- [Time] [Title] ([type])
**Prep blocks created:** [count]
**Delivery target:** [recipient]
**Skipped (already prepped):** [count]
**Durable prep artifacts saved:** [none or count]
```

### Save a durable prep artifact only when justified
Save to:
```
brain/meetings/prep/YYYY-MM-DD.md
```

Only when one of these is true:
- the meeting is strategic/high-stakes (investor, advisory, major client issue, key hiring, board-level, major partnership)
<!-- IF_EA -->
- [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] explicitly asks to save the prep
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
- [EXECUTIVE_FIRST_NAME] explicitly asks to save the prep
<!-- END_IF_NO_EA -->
- you are intentionally building a calibration set for improving prep quality

---

## Edge Cases

**No meetings in target window:**
- Post a short "no meetings to prep" note to the configured recipient
- Do not create prep blocks
- Do not create prep log or session-log entries

**Weekend:**
- Skip entirely unless meetings exist on the calendar

**Cancelled meetings:**
- If calendar event has status "cancelled", skip it

**Recurring meetings with no new context:**
- Still generate a brief but note "No new updates since last [meeting name]"

**CRM/Airtable API unavailable:**
- Fall back to memory/people/ + brain/meetings/debriefs/ only for client meetings
- Note in the brief: "CRM data unavailable — using local context only"

**Web research fails for external meetings:**
- Note: "Limited public info available"
- Still include calendar description and any attendee emails for context

**Token refresh needed:**
- google-api.sh auto-refreshes tokens

---

## Schedule

- **Scheduled run:** Daily 3:00pm local time, Monday-Friday — prepares **tomorrow's** meetings
- **Manual run:** Can be used for same-day prep when explicitly requested
- **Delivery:** Configured recipient via message tool
- **Timeout:** 300 seconds (web research for externals can be slow)
- **Runtime wiring:** Cron/config/session layers decide the delivery target and routing

---

## Trigger

Triggered by an inter-session message from the main session (typically relayed from the Meeting Prep cron). Can also be triggered manually by saying things like "meeting prep", "prep my meetings", "prep for tomorrow", or "prep for today".
