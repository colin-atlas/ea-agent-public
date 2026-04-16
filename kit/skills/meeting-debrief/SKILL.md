---
name: meeting-debrief
<!-- IF_EA -->
description: "Poll Fathom for new meeting transcripts, generate structured debrief markdown files, write people observations to memory/people/, create tasks for [EXECUTIVE_FIRST_NAME]'s action items, and deliver the debriefs to the group DM."
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
description: "Poll Fathom for new meeting transcripts, generate structured debrief markdown files, write people observations to memory/people/, create tasks for [EXECUTIVE_FIRST_NAME]'s action items, and deliver the debriefs to DM."
<!-- END_IF_NO_EA -->
---

# Meeting Debrief

<!-- IF_EA -->
Polls Fathom for unprocessed meetings, analyzes transcripts, extracts decisions/actions/people insights, saves canonical markdown debriefs to `brain/meetings/debriefs/`, writes people insights to `memory/people/`, creates action-item tasks, and delivers debriefs to the group DM.
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
Polls Fathom for unprocessed meetings, analyzes transcripts, extracts decisions/actions/people insights, saves canonical markdown debriefs to `brain/meetings/debriefs/`, writes people insights to `memory/people/`, creates action-item tasks, and delivers debriefs to DM.
<!-- END_IF_NO_EA -->

Runs every 15 min during work hours (Mon-Fri, 7am-6pm local) via cron. Exits silently if nothing new.

---

## Write Contract

| Output | Target | When |
|--------|--------|------|
| **Primary:** Canonical debrief file | `brain/meetings/debriefs/YYYY-MM-DD-{slug}.md` | Every processed meeting |
| **Primary:** Action item tasks | `db/tasks.db` (INSERT, status=backlog) | Each significant action item |
| **Secondary:** People observations | `memory/people/{name}.md` (append or create) | Each attendee with insights |
| **Secondary:** Decisions | `memory/decisions.md` (append) | Significant decisions only |
| **Secondary:** Session log | `memory/YYYY-MM-DD.md` (append) | After all meetings processed |
<!-- IF_EA -->
| **Delivery:** Debrief message | Group DM | One message per meeting |
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
| **Delivery:** Debrief message | DM | One message per meeting |
<!-- END_IF_NO_EA -->
| **Archive:** Older debriefs | `brain/archive/meetings/debriefs/YYYY-MM/` | Moved after 30 days by archive workflow |

**Naming:** Debrief files use `YYYY-MM-DD-{slug}.md`; people files use lowercase-hyphenated names (`first-last.md`). Task source: `meeting:{title}`.
**Skip write when:** `total_new == 0` — exit silently, write nothing, no log entry.

---

## Setup

- **Fathom API:** `scripts/fathom-api.sh` (API key at `~/.openclaw/secrets/fathom-api-key`)
- **Canonical debrief store:** `brain/meetings/debriefs/` — one markdown file per meeting
- **People files:** `memory/people/{name}.md` — per-person observations, indexed by QMD
- **Debrief template:** `skills/meeting-debrief/references/debrief-template.md`
- **Archive target:** `brain/archive/meetings/debriefs/YYYY-MM/` for debriefs older than 30 days

---

## Step 0: Check for new meetings

```bash
bash scripts/fathom-api.sh new-since 20
```

Parse the JSON response. If `total_new == 0`:
- **Do NOT write anything to any file** — no memory log, no session log, no output
- **Do NOT append to `memory/YYYY-MM-DD.md`**
- **STOP immediately** — exit the skill, no further steps

If meetings found: process each one sequentially (most recent first).

---

## Step 1: Fetch transcript + summary

For each new meeting:

```bash
bash scripts/fathom-api.sh transcript {recording_id}
bash scripts/fathom-api.sh summary {recording_id}
```

Extract from the meetings list response:
- `recording_id` — unique Fathom ID
- `title` / `meeting_title` — meeting name
- `created_at` — date (extract YYYY-MM-DD)
- `calendar_invitees` — attendee names and emails
- `share_url` — link back to Fathom recording

The transcript is an array of `{speaker: {display_name}, text, timestamp}` entries.
The summary is `{summary: {markdown_formatted}}`.

---

## Step 2: Load attendee context

For each attendee, check if a person file exists in `memory/people/`:
```bash
ls memory/people/ | grep -i "{first_name}"
```

If found, read `memory/people/{name}.md` for context (role, company, communication style, past observations).
If not found, the person is new — you'll create their file in Step 5.

Load `brain/knowledge/team.md` for role context on team members.

---

## Step 3: Analyze transcript

Read the full transcript. Extract the following:

### 3a. Meeting metadata
- **Type**: classify as `1on1`, `team`, `l10`, `advisory`, `external`, or `standup`
  - Contains "1:1" or "1on1" in title -> `1on1`
  - Contains "Standup" -> `standup`
  - Contains "L10" -> `l10`
  - Contains "Advisory" or "Coaching" -> `advisory`
  - Has external invitees (non-company domains) -> `external`
  - Otherwise -> `team`
- **Tags**: `{type}` + attendee first names lowercase (e.g., `1on1, jane`)

### 3b. Summary (2-3 sentences)
What happened and key outcomes.

### 3c. Key discussion points (3-7 bullets)
Main topics discussed.

### 3d. Decisions made
Explicit decisions (not suggestions). Include who made them if clear.

### 3e. [EXECUTIVE_FIRST_NAME]'s action items — significant only
Things [EXECUTIVE_FIRST_NAME] explicitly committed to that are **strategic or material** — decisions to make, conversations to have, things that affect other people or projects.

**Extract:** decisions [EXECUTIVE_FIRST_NAME] owns, follow-ups with clients or stakeholders, strategic actions, anything that would visibly matter if missed.

**Skip:** small admin tasks ("send a file", "update the invite"), things already delegated, one-liners that take under 5 minutes.

Format: `[item] — due: [date or "TBD"]`

### 3f. Commitments from others — significant only
Things others committed to that **materially affect the business or [EXECUTIVE_FIRST_NAME]'s work**.

**Extract:** deliverables that [EXECUTIVE_FIRST_NAME] is depending on, things that affect clients, hiring, strategy, or money, commitments made in response to a direct ask.

<!-- IF_EA -->
**Skip:** routine items ("I'll send you that doc by EOD"), things [EA_FIRST_NAME] will just handle, status updates that are already in motion.
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
**Skip:** routine items ("I'll send you that doc by EOD"), status updates that are already in motion.
<!-- END_IF_NO_EA -->

Format: `[Person]: [commitment] — due: [date or "TBD"]`

### 3g. People insights
For each attendee (except [EXECUTIVE_FIRST_NAME]), extract only what makes [AGENT_NAME] more effective as EA:
- **Save**: working style, motivations, tension points, relationship dynamics, patterns, strategic context
- **Save**: major commitments made in this meeting
- **Skip**: one-off operational details, EA-level specifics

Note type for each insight:
- `dynamic` — how they operate, their energy, what motivates them
- `learned_fact` — something factual worth remembering
- `issue` — problem or concern they raised
- `commitment` — significant thing they committed to
- `decision` — decision they owned

### 3h. Leadership coaching ([EXECUTIVE_FIRST_NAME] only)
Write as an executive coach providing direct, specific feedback:
- How did [EXECUTIVE_FIRST_NAME] show up? What worked well?
- Could they have handled something better? Cite a specific moment from the transcript.
- Were there unspoken dynamics — tension, avoidance, someone disengaged, misalignment?
- One concrete growth area for [EXECUTIVE_FIRST_NAME] as a leader
- Tone: warm but honest, like a trusted coach. Not generic.
- Skip entirely for standups and very short syncs (<10 min)

---

## Step 4: Save canonical debrief markdown

Write one markdown file per meeting to:
```bash
brain/meetings/debriefs/YYYY-MM-DD-{slug}.md
```

Before writing, ensure the directory exists:
```bash
mkdir -p brain/meetings/debriefs
```

Use a stable slug derived from the meeting title: lowercase, hyphenated, strip punctuation, keep it human-readable. If a file for the same meeting already exists, update it in place instead of creating duplicates.

Required frontmatter:
```markdown
---
title: {Title}
date: {YYYY-MM-DD}
type: {type}
attendees:
  - {Attendee 1}
  - {Attendee 2}
tags:
  - {tag1}
  - {tag2}
fathom_id: {recording_id}
source: {share_url}
---
```

Then write the full debrief markdown body using `skills/meeting-debrief/references/debrief-template.md`.

The file body should use these exact section headers so the dashboard parser can extract them reliably:
- `## Summary`
- `## Key Discussion Points`
- `## Decisions Made`
- `## [EXECUTIVE_FIRST_NAME]'s Action Items`
- `## Commitments from Others`
- `## Leadership Coaching`

**IMPORTANT:** This markdown file is the canonical source of truth for the debrief. Do not treat any database as canonical for debrief content.

---

## Step 5: Save people observations to memory/people/

For each person insight extracted in Step 3g, write to `memory/people/{name}.md`.

**File naming:** lowercase, hyphenated — e.g., `memory/people/jane-doe.md`.

**If the file exists**, append observations under a `## Meeting Notes` section:
```bash
echo "" >> memory/people/{name}.md
echo "### {YYYY-MM-DD} — {meeting title}" >> memory/people/{name}.md
echo "- [{note_type}] {content}" >> memory/people/{name}.md
```

**If the file does NOT exist**, create it with a profile header + the notes:
```markdown
# {Full Name}

**Role:** {role if known}
**Company:** {company if known}
**Team member:** {yes/no}

## Meeting Notes

### {YYYY-MM-DD} — {meeting title}
- [{note_type}] {content}
```

Use `>>` (append) exclusively for existing files. Each note line should include the note_type prefix: `[dynamic]`, `[learned_fact]`, `[issue]`, `[commitment]`, `[decision]`.

---

## Step 6: Create tasks for [EXECUTIVE_FIRST_NAME]'s action items

For each action item identified in Step 3e:

```bash
sqlite3 db/tasks.db "
  INSERT INTO tasks (title, status, priority, owner, source, notes, due_date, created_at, updated_at)
  VALUES (
    '{action item}',
    'backlog',
    'med',
    '[EXECUTIVE_FIRST_NAME]',
    'meeting:{meeting_title}',
    'From meeting: {meeting_title} on {date}',
    '{due_date or NULL}',
    datetime('now'), datetime('now')
  );"
```

---

<!-- IF_EA -->
## Step 7: Deliver to Group DM

Read `skills/meeting-debrief/references/debrief-template.md` for format.

Deliver each debrief to the group DM. If multiple meetings were processed, send one message per meeting.
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
## Step 7: Deliver to DM

Read `skills/meeting-debrief/references/debrief-template.md` for format.

Deliver each debrief to the DM. If multiple meetings were processed, send one message per meeting.
<!-- END_IF_NO_EA -->

If the debrief is too long for one message (>3000 chars), split into multiple messages.

---

## Step 7b: Context Management

After processing each meeting debrief (before moving to the next one):
1. The transcript and analysis are now saved to the canonical debrief markdown file and `memory/people/` — you no longer need them in context
2. If processing multiple meetings, do them one at a time: fetch transcript -> analyze -> save markdown + write-backs -> post to DM -> then move to next meeting
3. Do NOT hold multiple transcripts in context simultaneously

After all meetings are processed, check your context usage with `session_status`. If above 50%, run a checkpoint:
- Append to `memory/YYYY-MM-DD.md`: meetings debriefed, key decisions, action items created
- Note: the full debrief content now lives in `brain/meetings/debriefs/` — no need to keep it in session memory

## Step 8: Log to memory (APPEND, never overwrite)

**CRITICAL:** Always APPEND to the daily log file. Never overwrite existing content.

First check if the memory file exists and has content:
```bash
LOG_FILE="memory/$(date +%Y-%m-%d).md"
if [ -s "$LOG_FILE" ]; then
  echo "" >> "$LOG_FILE"
fi
```

Then append the entry:
```
echo "## Meeting Debrief — {title} [{time}]" >> "$LOG_FILE"
echo "Debriefed: {title} | Attendees: {names} | Actions created: N | People notes: N" >> "$LOG_FILE"
```

### Feed back into knowledge graph

After logging to daily memory, also write to topic files:

**Decisions:** If any significant decisions were extracted (3d above), append to `memory/decisions.md`:
```
## [YYYY-MM-DD] {decision title}
**Context:** {meeting title} — {who was there}
**Decision:** {what was decided}
**Reasoning:** {why, if clear from transcript}
**Status:** active
```

**When no meetings found (total_new == 0):**
Do NOT log anything. No "Meeting Debrief Check" entry. No output. Just exit silently.

**Only log when meetings were actually processed.** Use `>>` (append) operator exclusively. Never use `>` (overwrite).

---

## Edge cases

- **Transcript empty or null**: Use Fathom's auto-summary only, note "transcript unavailable" in debrief
- **Very short meeting (<5 min)**: Skip leadership note, keep debrief brief
- **Already processed** (duplicate fathom_id): Skip silently
- **API error**: Log error to daily memory log, continue with next meeting
- **Multiple meetings**: Process all, deliver a separate group-DM message per meeting

## References
- `references/debrief-template.md`
