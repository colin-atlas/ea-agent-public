---
name: knowledge-audit
description: "Weekly audit of workspace files and brain/ vault. Reviews the week's accumulated context from databases, logs, and reports, then proposes updates to keep everything current. Runs Fridays after Weekly Review. Triggers on 'knowledge audit', 'vault audit', 'refresh knowledge', 'update core files'."
---

# Knowledge Audit

## Context Mode

This workflow should run with **full context**, not `lightContext`.

Reason:
- it audits cross-file consistency across `MEMORY.md`, `memory/`, `brain/`, reports, and workflow outputs
- it owns archival hygiene for both daily logs and meeting debriefs
- it is part of the memory/knowledge stewardship layer, so bootstrap context improves judgment and contradiction detection

## Write Contract

| Output | Target | When |
|--------|--------|------|
| **Primary:** Core file updates | `MEMORY.md`, `USER.md`, `AGENTS.md`, `brain/knowledge/*.md`, `memory/*.md` | Only after [EXECUTIVE_FIRST_NAME] confirms |
| **Primary:** Daily log archival | `memory/archive/` (move logs 30+ days old) | Only after [EXECUTIVE_FIRST_NAME] confirms |
| **Primary:** Meeting debrief archival | `brain/archive/meetings/debriefs/YYYY-MM/` (move debriefs 30+ days old) | Only after [EXECUTIVE_FIRST_NAME] confirms |
| **Secondary:** Audit log | `memory/YYYY-MM-DD.md` (append) | After applying changes |
| **Delivery:** Proposed changes report | [EXECUTIVE_FIRST_NAME]'s DM | Phase 1 |

**Naming:** No new files created except archive folders as needed. Archived logs keep original names. Archived meeting debriefs grouped by `YYYY-MM`.
**Skip write when:** [EXECUTIVE_FIRST_NAME] doesn't respond (proposals expire after weekend). Never modify SOUL.md. If all files are current, log "no changes needed" only.

---

## Before you begin
Read these files for context:
- MEMORY.md (current priorities and routing)
- brain/projects/projects.md (active projects index)

Weekly reconciliation pass. Cross-reference what's accumulated in databases, logs, and reports against core files and brain/, then propose targeted updates to keep everything current.

This is a **propose-then-confirm** workflow. Generate proposed changes, deliver to [EXECUTIVE_FIRST_NAME] for review, then apply only what is approved.

---

## Phase 1: Audit & Propose

### Step 1 — Gather This Week's Context

**Daily logs:**
Read each daily log from this week from `memory/`.

**People files — this week's observations:**
Scan `memory/people/` files for entries from this week.

**Meeting debriefs — this week's decisions and action items:**
Review recent files in `brain/meetings/debriefs/` from the last 7 days. Extract decisions, action items, and notable meeting themes directly from the markdown files.

**Reports — this week's daily and weekly briefings:**
Read daily reports from `brain/reports/daily/` and weekly review from `brain/reports/weekly/` if present.

**Task board activity:**
```sql
SELECT al.action, al.details, al.actor, al.created_at, t.title
FROM activity_log al
LEFT JOIN tasks t ON al.entity_id = t.id AND al.entity_type = 'task'
WHERE date(al.created_at) >= date('now', '-6 days')
ORDER BY al.created_at DESC
LIMIT 50;
```

### Step 2 — Read Current Core Files

Read each file and note its current state:

| File | Path |
|---|---|
| MEMORY.md | `MEMORY.md` |
| USER.md | `USER.md` |
| AGENTS.md | `AGENTS.md` |
| Company | `brain/knowledge/company.md` |
| Team | `brain/knowledge/team.md` |
| Big Three Goals | `brain/knowledge/big-three-goals.md` |
| Brand Guidelines | `brain/knowledge/brand-guidelines.md` |
| Task Mgmt Protocol | `brain/knowledge/task-management-protocol.md` |
| Decisions | `memory/decisions.md` |
| Patterns | `memory/patterns.md` |
| Corrections | `memory/corrections.md` |

**Do NOT read or propose changes to SOUL.md** — identity is sacred. Only update on [EXECUTIVE_FIRST_NAME]'s explicit request.

### Step 3 — Identify Gaps

For each file, compare current content against this week's accumulated context. Look for:

- **Stale info** — facts that are no longer accurate
- **Missing info** — things learned this week not yet reflected
- **Redundancies** — duplicate entries or conflicting statements
- **Promotions** — learnings/patterns that have repeated enough to become permanent

Specific checks per file:

**MEMORY.md:**
- Any new persistent facts to add?
- Anything stale to remove or move to a topic file?
- Line count check — MEMORY.md must stay under 200 lines (it's a routing doc, not a knowledge store)
- Any section that hasn't been updated in 2+ weeks?

**USER.md:**
- New preferences expressed this week?
- Goals shifted? Challenges changed?

**brain/knowledge/ docs:**
- Business changes? Team changes?
- Strategy shifts from meetings?
- Process changes?

### Step 3b — Brain Vault Audit

Audit the `brain/` directory for structural health.

**Cross-links:**
- Scan `brain/knowledge/` and `brain/projects/` for wiki-links (`[[...]]`). Flag broken links.
- Identify knowledge docs that should cross-reference each other but don't.

**Staleness:**
- Check file modification dates in `brain/knowledge/`:
  ```bash
  for f in brain/knowledge/*.md; do
    echo "$(stat -c '%Y %n' "$f" | awk '{print strftime("%Y-%m-%d",$1), $2}')"
  done
  ```
- Flag any knowledge doc not updated in 30+ days as potentially stale.

**Contradictions:**
- Compare `memory/decisions.md` entries from this week against `brain/knowledge/` docs.
- Check `memory/patterns.md` for patterns that should be promoted to a knowledge doc.

**Projects index:**
- Verify `brain/projects/projects.md` lists all active project directories.
- Flag orphaned dirs or stale index entries.

**Reports completeness:**
- Check `brain/reports/weekly/` — was a weekly review written this Friday?
- Check `brain/reports/daily/` — any gaps in SOD/EOD reports this week?

### Step 3c — Archival Hygiene

Check if any daily logs in `memory/` are older than 30 days:
```bash
find memory/ -maxdepth 1 -name "????-??-??.md" -mtime +30 -type f | sort
```

If found, propose moving them to `memory/archive/`.

Also check if any meeting debrief files in `brain/meetings/debriefs/` are older than 30 days:
```bash
find brain/meetings/debriefs -maxdepth 1 -name "*.md" -mtime +30 -type f | sort
```

If found, propose moving them to `brain/archive/meetings/debriefs/YYYY-MM/`.

### Step 4 — Compose Proposed Changes Report

Format the report as a clear, reviewable list of proposed changes:

```
**Knowledge Audit — Week of [Mon] - [Fri]**

---

**Summary:** [X] files reviewed, [Y] proposed changes

---

### MEMORY.md
**Current size:** [X] lines / 200 max

**Proposed additions:**
- [Section] -> Add: "[new fact]"
  - *Source: [where this was learned]*

**Proposed removals (-> move to topic files):**
- [Section] -> Remove: "[stale entry]"
  - *Reason: [why]*

**No changes needed:** [if clean]

---

[Continue for each file...]

---

### Brain Vault Health
**Cross-links:** [N broken, N suggested]
**Staleness:** [N docs flagged]
**Contradictions:** [N found, or "None"]
**Projects index:** [in sync / N mismatches]
**Reports:** [complete / N gaps]

### Daily Log Archival
**Logs older than 30 days:** [N files]
- [list of files to archive]

### Meeting Debrief Archival
**Debriefs older than 30 days:** [N files]
- [list of files to archive]

---

*Reply to confirm all, or tell me which changes to apply/skip.*
```

### Step 5 — Deliver to [EXECUTIVE_FIRST_NAME]

Deliver the proposed changes report. Split into multiple messages if over 2000 chars.

**Stop and wait for [EXECUTIVE_FIRST_NAME]'s response.** Do not apply any changes until confirmed.

---

## Phase 2: Apply Confirmed Changes

Triggered when [EXECUTIVE_FIRST_NAME] replies. They may:
- Confirm all -> apply everything
- Confirm selectively -> apply only specified changes
- Reject all -> do nothing
- Request modifications -> adjust then apply

### For each confirmed change:

**Additions:** Append or insert at the appropriate section.

**Removals from MEMORY.md -> archive first:**
- Decisions -> `memory/decisions.md`
- Patterns/preferences -> `memory/patterns.md`
- Corrections/gotchas -> `memory/corrections.md`
- People observations -> `memory/people/[name].md`
Then remove from MEMORY.md.

**Modifications:** Edit the specific line/section.

**Daily log archival (if confirmed):**
```bash
mkdir -p memory/archive
mv memory/YYYY-MM-DD.md memory/archive/
```

**Meeting debrief archival (if confirmed):**
```bash
mkdir -p brain/archive/meetings/debriefs/YYYY-MM
mv brain/meetings/debriefs/YYYY-MM-DD-*.md brain/archive/meetings/debriefs/YYYY-MM/
```

### After applying all changes:

1. Log everything to today's session log:
```
## Knowledge Audit [HH:MM UTC]
**Files updated:** [list]
**Changes applied:** [count]
**Moved to topic files:** [count]
**Daily logs archived:** [count]
**Meeting debriefs archived:** [count]
**Skipped/rejected:** [list if any]
```

2. Confirm to [EXECUTIVE_FIRST_NAME]:
```
Knowledge audit complete:
- [X] files updated
- [Y] entries moved to topic files
- [Z] daily logs archived
- [A] meeting debriefs archived
- [W] changes applied

[Brief summary of what changed]
```

---

## Edge Cases

**Nothing to update:**
- Report "All files current — no changes needed this week"
- Still log the audit to session log (so we know it ran)

**MEMORY.md over 200 lines after additions:**
- Must archive entries before adding new ones
- Propose specific entries to move to topic files with reasoning

**Uncertain changes:**
- If unsure whether something should be updated, flag it as "Uncertain" in the report
- Let [EXECUTIVE_FIRST_NAME] decide

**[EXECUTIVE_FIRST_NAME] doesn't respond:**
- Changes expire after the weekend — don't apply stale proposals the following week
- Next week's run generates fresh proposals

---

## Schedule

- **When:** Fridays, after Weekly Review completes
- **Delivery:** [EXECUTIVE_FIRST_NAME]'s DM
- **Cron timing:** ~5pm local — gives time after 4pm Weekly Review

---

## Tone

- Librarian energy — organized, precise, no fluff
- Show your work — cite where each proposed change came from
- Conservative — when in doubt, flag for [EXECUTIVE_FIRST_NAME] rather than proposing a change
- Respect the hierarchy: SOUL.md is untouchable, MEMORY.md is routing doc, topic files (memory/) are working memory, brain/ is polished knowledge
