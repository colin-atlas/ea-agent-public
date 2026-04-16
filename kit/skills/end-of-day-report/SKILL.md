---
name: end-of-day-report
<!-- IF_EA -->
description: "Daily closeout / end-of-day lock-in for [EXECUTIVE_FIRST_NAME], [EA_FIRST_NAME], and [AGENT_NAME]. Use when running the weekday EOD / wrap-up workflow. Produces a draft closeout, handles review in the group DM, and writes durable updates only after [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms."
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
description: "Daily closeout / end-of-day lock-in for [EXECUTIVE_FIRST_NAME] and [AGENT_NAME]. Use when running the weekday EOD / wrap-up workflow. Produces a draft closeout, handles review in DM, and writes durable updates only after [EXECUTIVE_FIRST_NAME] confirms."
<!-- END_IF_NO_EA -->
---

# End of Day Report

<!-- IF_EA -->
EOD is a **daily closeout / end-of-day lock-in workflow** for the operating triangle:
- [EXECUTIVE_FIRST_NAME]
- [EA_FIRST_NAME]
- [AGENT_NAME]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
EOD is a **daily closeout / end-of-day lock-in workflow** for:
- [EXECUTIVE_FIRST_NAME]
- [AGENT_NAME]
<!-- END_IF_NO_EA -->

It is not just a report. Its job is to close the day cleanly, decide carryforwards, capture learnings, and prepare tomorrow's provisional starting state.

## Write Contract

| Output | Target | When |
|--------|--------|------|
| **Primary:** Workflow state | `reports/eod-state.json` | On draft creation, revisions, Friday handoff, and confirmation |
<!-- IF_EA -->
| **Primary:** Finalized EOD report | `brain/reports/daily/YYYY-MM-DD.md` (append) | Only after [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms |
| **Primary:** Task board updates | `db/tasks.db` via `./tasks` | Only after [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms |
| **Secondary:** EOD checkpoint | `memory/YYYY-MM-DD.md` (append) | Only after [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms |
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
| **Primary:** Finalized EOD report | `brain/reports/daily/YYYY-MM-DD.md` (append) | Only after [EXECUTIVE_FIRST_NAME] confirms |
| **Primary:** Task board updates | `db/tasks.db` via `./tasks` | Only after [EXECUTIVE_FIRST_NAME] confirms |
| **Secondary:** EOD checkpoint | `memory/YYYY-MM-DD.md` (append) | Only after [EXECUTIVE_FIRST_NAME] confirms |
<!-- END_IF_NO_EA -->
| **Secondary:** Topic file promotions | `memory/decisions.md`, `memory/patterns.md`, `memory/corrections.md`, `memory/people/*.md`, `brain/projects/*/state.md` | Only after confirmation, if learnings warrant promotion |
<!-- IF_EA -->
| **Delivery:** Draft + revisions + lock-in confirmation | Group DM | During review workflow |
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
| **Delivery:** Draft + revisions + lock-in confirmation | DM | During review workflow |
<!-- END_IF_NO_EA -->

**Naming:** Report section: `## Daily Closeout — [HH:MM [CLIENT_TZ_ABBREV]]`. Checkpoint: `## EOD Checkpoint [HH:MM UTC]`.
**Skip write when:** If nobody confirms, leave `reports/eod-state.json` in draft/pending state only. Do not write the daily report, task updates, checkpoint, or topic-file promotions.
<!-- IF_EA -->
**Authority:** [EXECUTIVE_FIRST_NAME] can confirm or modify everything. [EA_FIRST_NAME] can confirm operationally on [EXECUTIVE_FIRST_NAME]'s behalf. If [EA_FIRST_NAME] confirms, log it explicitly as "Confirmed by [EA_FIRST_NAME] on [EXECUTIVE_FIRST_NAME]'s behalf."
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
**Authority:** [EXECUTIVE_FIRST_NAME] can confirm or modify everything.
<!-- END_IF_NO_EA -->

## Workflow

### Step 0: Preflight

Before gathering anything:
1. Determine whether today is Mon-Thu or Friday.
2. Read `reports/eod-state.json` if it exists.
3. If today's EOD is already `confirmed`, do not regenerate a duplicate unless explicitly asked.
4. If today's EOD is still in `draft`, `pending_review`, `pending_confirmation`, or `friday_handoff`, resume from that state instead of starting over blindly.
5. Friday is special:
   - do not run a normal standalone Mon-Thu EOD flow
   - instead prepare a Friday handoff closeout for Weekly Review and mark state accordingly

### Step 1: Gather Closeout Inputs

#### 1a. Task board reality
```bash
./tasks list --status today,in_progress,needs_review,blocked,backlog --limit 100
./tasks sacred-six
```

Also identify:
- tasks completed today
- stale `today` tasks not actually done
- blocked tasks
- needs_review tasks
- backlog items likely to carry forward

#### 1b. Calendar context
```bash
./scripts/google-api.sh --all calendar-today
./scripts/google-api.sh --all calendar-tomorrow
```
Use today for closeout context and tomorrow for provisional planning / prep flags.

#### 1c. Inbox / unresolved flags
Preferred source:
```bash
cat inbox-triage/$(TZ="[CLIENT_TIMEZONE]" date +%Y-%m-%d)-pm.md 2>/dev/null
```
Fallbacks:
- `-am.md`
- `./scripts/google-api.sh --all gmail "label:0-Needs-Attention" 5`
Only surface what still matters after today.

#### 1d. Team injects
```bash
cat reports/eod-inject-$(TZ="[CLIENT_TIMEZONE]" date +%Y-%m-%d).md 2>/dev/null
```
If present, incorporate relevant items into the closeout rather than dumping them raw.

#### 1e. Today's workflow state + session log
Read for context:
- `reports/sod-state.json`
- `reports/eod-state.json`
- today's `memory/YYYY-MM-DD.md`

Unlike SOD, EOD should use today's session log because EOD is the day-consolidation and compounding point.

### Step 2: Produce Draft Daily Closeout

Use `references/report-template.md`.

The draft must include:
- day verdict
- [EXECUTIVE_FIRST_NAME] closeout
<!-- IF_EA -->
- [EA_FIRST_NAME] closeout
<!-- END_IF_EA -->
- [AGENT_NAME] closeout
- Sacred Six / strategic progress
- carryforwards
- inbox / unresolved flags
<!-- IF_EA -->
- tomorrow's provisional plan for [EXECUTIVE_FIRST_NAME], [EA_FIRST_NAME], and [AGENT_NAME]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
- tomorrow's provisional plan for [EXECUTIVE_FIRST_NAME] and [AGENT_NAME]
<!-- END_IF_NO_EA -->
- learnings to capture

Update `reports/eod-state.json` with:
- today's date
- `status: "draft"` (or `friday_handoff` on Friday)
- draft-generated timestamp
- day verdict
- closeout summary
- carryforwards
- tomorrow provisional plan
- learnings to capture
<!-- IF_EA -->
- `pending_confirmation_from: "either"`
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
- `pending_confirmation_from: "[EXECUTIVE_FIRST_NAME]"`
<!-- END_IF_NO_EA -->

<!-- IF_EA -->
Post the draft to the group DM and end with:
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
Post the draft to the DM and end with:
<!-- END_IF_NO_EA -->
**"Anything to adjust before I lock the day?"**

### Step 3: Handle Review

This workflow is collaborative.

<!-- IF_EA -->
- If [EA_FIRST_NAME] responds with changes, revise the closeout, update `reports/eod-state.json`, and post an updated draft.
<!-- END_IF_EA -->
- If [EXECUTIVE_FIRST_NAME] responds with changes, revise the closeout, update `reports/eod-state.json`, and post an updated draft.
- If either asks clarifying questions, answer and continue.
<!-- IF_EA -->
- If [EA_FIRST_NAME] confirms, treat it as operational confirmation on [EXECUTIVE_FIRST_NAME]'s behalf unless the closeout implies a strategic reprioritization that should visibly go back to [EXECUTIVE_FIRST_NAME].
<!-- END_IF_EA -->

Use state transitions:
- first draft -> `draft`
- revisions in progress -> `pending_review`
- revised draft awaiting signoff -> `pending_confirmation`
- confirmed closeout -> `confirmed`
- Friday bridge into weekly review -> `friday_handoff`

### Step 4: Lock In

<!-- IF_EA -->
When [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms:
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
When [EXECUTIVE_FIRST_NAME] confirms:
<!-- END_IF_NO_EA -->

1. Update `reports/eod-state.json`:
   - `status: "confirmed"`
<!-- IF_EA -->
   - `confirmed_by`
   - `confirmed_on_behalf_of` when [EA_FIRST_NAME] confirms
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
   - `confirmed_by`
<!-- END_IF_NO_EA -->
   - confirmation timestamp
   - changes from review

2. Process task transitions using `./tasks` where possible:
```bash
./tasks update <id> --status done
./tasks update <id> --status in_progress
./tasks update <id> --status blocked
./tasks update <id> --status needs_review
```

3. Make carryforward decisions explicit:
- what carries to tomorrow
- who owns it
- what status it should hold
- what is deprioritized / archived / blocked

4. Promotion checkpoint — scan today's work for durable learnings worth promotion:
- decisions -> `memory/decisions.md`
- patterns -> `memory/patterns.md`
- corrections -> `memory/corrections.md`
- people insights -> `memory/people/{name}.md`
- project status changes -> relevant `brain/projects/{name}/state.md`
If nothing deserves promotion, skip it.

5. Append the finalized report to `brain/reports/daily/YYYY-MM-DD.md`:
```markdown
## Daily Closeout — [HH:MM [CLIENT_TZ_ABBREV]]

<!-- IF_EA -->
[FULL finalized EOD draft as posted in group DM]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
[FULL finalized EOD draft as posted in DM]
<!-- END_IF_NO_EA -->

---

### Lock-In — [HH:MM [CLIENT_TZ_ABBREV]]

**[EXECUTIVE_FIRST_NAME] carryforward priorities:**
1. ...
2. ...
3. ...

<!-- IF_EA -->
**[EA_FIRST_NAME] carryforward priorities:**
1. ...
2. ...
3. ...

<!-- END_IF_EA -->
**[AGENT_NAME] carryforward priorities:**
1. ...
2. ...
3. ...

**Modifications from review:** [list or "None"]
<!-- IF_EA -->
**Confirmed by:** [[EXECUTIVE_FIRST_NAME] / [EA_FIRST_NAME] on [EXECUTIVE_FIRST_NAME]'s behalf]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
**Confirmed by:** [EXECUTIVE_FIRST_NAME]
<!-- END_IF_NO_EA -->
**Confirmed at:** [HH:MM [CLIENT_TZ_ABBREV]]

---
```

6. Append the EOD checkpoint to `memory/YYYY-MM-DD.md`:
```markdown
## EOD Checkpoint [HH:MM UTC]

**Day verdict:** [on track / mixed / slipped / blocked]
**Completed today:** [brief list or count]
**Carryforwards:** [brief list]
**Tomorrow provisional priorities:** [brief list]
**Inbox flags:** [count or "clear"]
**Promoted to topic files:** [count or "none"]
<!-- IF_EA -->
**Confirmed by:** [[EXECUTIVE_FIRST_NAME] / [EA_FIRST_NAME] on [EXECUTIVE_FIRST_NAME]'s behalf]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
**Confirmed by:** [EXECUTIVE_FIRST_NAME]
<!-- END_IF_NO_EA -->
```

<!-- IF_EA -->
7. Post confirmation in the group DM:
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
7. Post confirmation in the DM:
<!-- END_IF_NO_EA -->
- `Day locked in. Task board updated, report logged.`

### Step 5: Friday Handoff Behavior

Friday should not duplicate Weekly Review.

On Friday:
1. Produce a closeout draft that emphasizes:
   - final task reality for the week
   - unresolved carryforwards
   - week-end blockers
   - anything Weekly Review must address
2. Mark `reports/eod-state.json` as `friday_handoff` until Weekly Review finishes.
3. Ensure the workflow explicitly checks for completeness:
   - Friday daily closeout exists in `brain/reports/daily/`
   - Weekly Review exists in `brain/reports/weekly/` when expected
4. If either artifact is missing when it should exist, flag an operational gap.

### Step 6: Cleanup

If a same-day EOD inject file was consumed and is no longer needed, remove it after the finalized closeout is posted so it does not get reused.

## State File Contract

Canonical path: `reports/eod-state.json`

Suggested fields:
```json
{
  "date": "YYYY-MM-DD",
  "status": "draft|pending_review|pending_confirmation|confirmed|skipped|error|friday_handoff",
  "workflow": "eod",
<!-- IF_EA -->
  "delivery_surface": "group-dm",
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
  "delivery_surface": "dm",
<!-- END_IF_NO_EA -->
  "draft_generated_at": "ISO-8601",
  "day_verdict": "mixed",
  "closeout_summary": {
    "executive": [],
<!-- IF_EA -->
    "ea": [],
<!-- END_IF_EA -->
    "agent": []
  },
  "carryforwards": [],
  "tomorrow_provisional": {
    "executive_top_3": [],
<!-- IF_EA -->
    "ea_top_3": [],
<!-- END_IF_EA -->
    "agent_top_3": []
  },
  "learnings_to_capture": [],
<!-- IF_EA -->
  "pending_confirmation_from": "either",
  "confirmed_by": null,
  "confirmed_on_behalf_of": null,
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
  "pending_confirmation_from": "[EXECUTIVE_FIRST_NAME]",
  "confirmed_by": null,
<!-- END_IF_NO_EA -->
  "confirmed_at": null,
  "changes_from_review": [],
  "friday_handoff": null,
  "notes": []
}
```

## Edge Cases

**Light day:** Be honest about it.

**Calendar unavailable:** Still produce EOD with schedule context marked unavailable.

**Inbox unavailable:** Still produce EOD with inbox section marked unavailable.

<!-- IF_EA -->
**No meaningful [EA_FIRST_NAME] tasks in DB:** Derive [EA_FIRST_NAME]'s closeout and tomorrow priorities from actual operating work.

<!-- END_IF_EA -->
**Existing confirmed EOD for today:** Do not regenerate unless explicitly requested.

**Nobody confirms:** Leave only the draft state file; do not write the report, task board updates, checkpoint, or promotions.

## Trigger

<!-- IF_EA -->
This skill may be triggered by cron or manually in the group DM. The trigger should be thin: "Run End of Day." Routing/session details belong in cron or wrapper logic, not in the core skill definition.
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
This skill may be triggered by cron or manually in DM. The trigger should be thin: "Run End of Day." Routing/session details belong in cron or wrapper logic, not in the core skill definition.
<!-- END_IF_NO_EA -->

## References
- `references/report-template.md`
