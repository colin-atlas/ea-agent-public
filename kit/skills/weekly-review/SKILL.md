---
name: weekly-review-and-planning
<!-- IF_EA -->
description: "Weekly closeout + next-week lock-in for [EXECUTIVE_FIRST_NAME], [EA_FIRST_NAME], and [AGENT_NAME]. Use when running the Friday weekly review / weekly planning workflow. Produces a draft weekly assessment, handles review in the group DM, and writes durable updates only after [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms."
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
description: "Weekly closeout + next-week lock-in for [EXECUTIVE_FIRST_NAME] and [AGENT_NAME]. Use when running the Friday weekly review / weekly planning workflow. Produces a draft weekly assessment, handles review in DM, and writes durable updates only after [EXECUTIVE_FIRST_NAME] confirms."
<!-- END_IF_NO_EA -->
---

# Weekly Review & Planning

<!-- IF_EA -->
Weekly Review is the **weekly closeout + next-week lock-in workflow** for the operating triangle:
- [EXECUTIVE_FIRST_NAME]
- [EA_FIRST_NAME]
- [AGENT_NAME]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
Weekly Review is the **weekly closeout + next-week lock-in workflow** for:
- [EXECUTIVE_FIRST_NAME]
- [AGENT_NAME]
<!-- END_IF_NO_EA -->

It is the weekly anchor for the operating system. Its job is to close the week honestly, assess the Big Three, triage open items, confirm Sacred Six, refresh active focus, and lock in next week.

## Context Mode

This workflow should run with **full main-session context**. Do **not** use `lightContext` for Weekly Review. It should have normal bootstrap access because it depends on durable memory, active focus, project state, and accumulated weekly context.

## Write Contract

| Output | Target | When |
|--------|--------|------|
| **Primary:** Workflow state | `reports/weekly-review-state.json` | On draft creation, revisions, and confirmation |
<!-- IF_EA -->
| **Primary:** Weekly report | `brain/reports/weekly/YYYY-MM-DD.md` (append) | Only after [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms |
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
| **Primary:** Weekly report | `brain/reports/weekly/YYYY-MM-DD.md` (append) | Only after [EXECUTIVE_FIRST_NAME] confirms |
<!-- END_IF_NO_EA -->
| **Primary:** Sacred Six updates | `db/tasks.db` via `./tasks` | Only after confirmation |
| **Primary:** Active Focus refresh | `MEMORY.md` `## Active Focus` section | Only after confirmation |
| **Primary:** Dashboard state | `dashboard-state.json` Big Three RAG, if used | Only after confirmation |
| **Secondary:** Weekly checkpoint | `memory/YYYY-MM-DD.md` (append) | Only after confirmation |
| **Secondary:** Topic file promotions | `memory/decisions.md`, `memory/patterns.md`, `memory/corrections.md`, `memory/people/*.md`, `brain/projects/*/state.md` | Only after confirmation, if learnings warrant promotion |
<!-- IF_EA -->
| **Delivery:** Draft + revisions + lock-in confirmation | Group DM | During review workflow |
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
| **Delivery:** Draft + revisions + lock-in confirmation | DM | During review workflow |
<!-- END_IF_NO_EA -->

**Naming:** Weekly report section: `## Weekly Review — [HH:MM [CLIENT_TZ_ABBREV]]`.
**Skip write when:** If nobody confirms, leave `reports/weekly-review-state.json` in draft/pending state only. Do not write the weekly report, Sacred Six updates, MEMORY active focus refresh, dashboard updates, checkpoint, or promotions.
<!-- IF_EA -->
**Authority:** [EXECUTIVE_FIRST_NAME] can confirm or modify everything. [EA_FIRST_NAME] can confirm operationally on [EXECUTIVE_FIRST_NAME]'s behalf. If [EA_FIRST_NAME] confirms, log it explicitly as "Confirmed by [EA_FIRST_NAME] on [EXECUTIVE_FIRST_NAME]'s behalf."
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
**Authority:** [EXECUTIVE_FIRST_NAME] can confirm or modify everything.
<!-- END_IF_NO_EA -->

## Before You Begin

Read `brain/knowledge/task-management-protocol.md` for the full task operating standard — especially the **Sacred Six** and **Today's Focus** sections. Weekly review is responsible for setting the Sacred Six for the coming week.

## Workflow

### Step 0: Preflight

Before gathering anything:
1. Determine the current work week boundaries (Monday-Friday).
2. Read `reports/weekly-review-state.json` if it exists.
3. Read Friday handoff context from `reports/eod-state.json` if present.
4. If this week's weekly review is already `confirmed`, do not regenerate a duplicate unless explicitly asked.
5. If this week's weekly review is still in `draft`, `pending_review`, or `pending_confirmation`, resume from that state instead of starting over blindly.

### Step 1: Gather Weekly Inputs

#### 1a. This week's task board reality
```bash
./tasks list --status today,in_progress,needs_review,blocked,backlog --limit 100
./tasks sacred-six
```
Also gather what was completed this week and what has gone stale.

#### 1b. This week's daily reports
Read the daily reports that exist for the current week from `brain/reports/daily/`.
Use them to understand how the week actually unfolded, not just how tasks were labeled.

#### 1c. This week's daily logs
Read `memory/YYYY-MM-DD.md` for the current week.
Look for:
- decisions
- blockers
- slippage
- confirmed patterns
- people insights
- project movement

#### 1d. Friday handoff / continuity context
Read:
- `reports/eod-state.json`
- whether Friday daily closeout exists in `brain/reports/daily/`
This workflow must explicitly check reporting continuity.

#### 1e. Big Three context
Read the current Big Three context and relevant project state.
Assess what actually moved this week versus what only generated motion.

#### 1f. Calendar context
Read:
- this week's calendar
- next week's calendar
Use them to spot heavy days, prep needs, and timing risks.

#### 1g. Inbox / unresolved items
Surface only meaningful unresolved items that should affect next week.

#### 1h. Team injects / notable meeting context
If there are injects or especially important meeting debriefs from the week, use them to sharpen the review — don't dump them raw.

### Step 2: Produce Draft Weekly Review

Use `references/report-template.md`.

The draft must include:
- week verdict
<!-- IF_EA -->
- operating triangle weekly closeout ([EXECUTIVE_FIRST_NAME] / [EA_FIRST_NAME] / [AGENT_NAME])
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
- weekly closeout ([EXECUTIVE_FIRST_NAME] / [AGENT_NAME])
<!-- END_IF_NO_EA -->
- Big Three review with RAG
- open-item triage
- next week preview
- Sacred Six proposal
<!-- IF_EA -->
- next-week focus for [EXECUTIVE_FIRST_NAME] / [EA_FIRST_NAME] / [AGENT_NAME]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
- next-week focus for [EXECUTIVE_FIRST_NAME] / [AGENT_NAME]
<!-- END_IF_NO_EA -->
- learnings to capture
- continuity / completeness check

Update `reports/weekly-review-state.json` with:
- week start / week end
- `status: "draft"`
- draft-generated timestamp
- week verdict
- Big Three state snapshot
- triangle summary
- open-item triage
- Sacred Six candidates
- next-week focus
- learnings to capture
- continuity check
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
**"Anything to adjust before we lock next week?"**

### Step 3: Handle Review

This workflow is collaborative.

<!-- IF_EA -->
- If [EA_FIRST_NAME] responds with changes, revise the review, update `reports/weekly-review-state.json`, and post an updated draft.
<!-- END_IF_EA -->
- If [EXECUTIVE_FIRST_NAME] responds with changes, revise the review, update `reports/weekly-review-state.json`, and post an updated draft.
- If either asks clarifying questions, answer and continue.
<!-- IF_EA -->
- If [EA_FIRST_NAME] confirms, treat it as operational confirmation on [EXECUTIVE_FIRST_NAME]'s behalf unless the review implies a material strategic reprioritization that should visibly go back to [EXECUTIVE_FIRST_NAME].
<!-- END_IF_EA -->

Use state transitions:
- first draft -> `draft`
- revisions in progress -> `pending_review`
- revised draft awaiting signoff -> `pending_confirmation`
- confirmed weekly lock-in -> `confirmed`

### Step 4: Lock In

<!-- IF_EA -->
When [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms:
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
When [EXECUTIVE_FIRST_NAME] confirms:
<!-- END_IF_NO_EA -->

1. Update `reports/weekly-review-state.json`:
   - `status: "confirmed"`
   - `confirmed_by`
<!-- IF_EA -->
   - `confirmed_on_behalf_of` when [EA_FIRST_NAME] confirms
<!-- END_IF_EA -->
   - confirmation timestamp
   - changes from review

2. Confirm Sacred Six:
- prefer 6 directly
- if more than 6 candidates were discussed, narrow them at lock-in
- ensure each confirmed item exists on the task board
- apply Sacred Six tagging using the canonical task path where possible

3. Triage open items explicitly:
- keep / delegate / archive / reframe
- do not let stale work roll forward silently

4. Promotion checkpoint — scan the week for durable learnings worth promotion:
- decisions -> `memory/decisions.md`
- patterns -> `memory/patterns.md`
- corrections -> `memory/corrections.md`
- people insights -> `memory/people/{name}.md`
- project status changes -> relevant `brain/projects/{name}/state.md`
If nothing deserves promotion, skip it.

5. Append the finalized report to `brain/reports/weekly/YYYY-MM-DD.md`:
```markdown
## Weekly Review — [HH:MM [CLIENT_TZ_ABBREV]]

<!-- IF_EA -->
[FULL finalized weekly review draft as posted in group DM]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
[FULL finalized weekly review draft as posted in DM]
<!-- END_IF_NO_EA -->

---

### Lock-In — [HH:MM [CLIENT_TZ_ABBREV]]

**Confirmed Sacred Six:**
1. ...
2. ...
3. ...
4. ...
5. ...
6. ...

**[EXECUTIVE_FIRST_NAME] next-week focus:**
1. ...
2. ...
3. ...

<!-- IF_EA -->
**[EA_FIRST_NAME] next-week focus:**
1. ...
2. ...
3. ...

<!-- END_IF_EA -->
**[AGENT_NAME] next-week focus:**
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

6. Append the weekly checkpoint to `memory/YYYY-MM-DD.md`:
```markdown
## Weekly Review Checkpoint [HH:MM UTC]

**Week verdict:** [strong / mixed / drifted / blocked]
**Big Three:** [Goal1]=[RAG] | [Goal2]=[RAG] | [Goal3]=[RAG]
**Confirmed Sacred Six:** [brief list]
**Next-week focus:** [brief list]
**Continuity check:** [ok / gaps]
**Promoted to topic files:** [count or "none"]
<!-- IF_EA -->
**Confirmed by:** [[EXECUTIVE_FIRST_NAME] / [EA_FIRST_NAME] on [EXECUTIVE_FIRST_NAME]'s behalf]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
**Confirmed by:** [EXECUTIVE_FIRST_NAME]
<!-- END_IF_NO_EA -->
```

7. Refresh `MEMORY.md` Active Focus only:
- update `## Active Focus` to reflect the locked next-week priorities
- keep to 3-5 concise bullets
- do not change any other section of `MEMORY.md`

8. Update `dashboard-state.json` Big Three RAG if still part of the dashboard UX.

<!-- IF_EA -->
9. Post confirmation in the group DM:
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
9. Post confirmation in the DM:
<!-- END_IF_NO_EA -->
- `Weekly review locked in. Sacred Six updated, active focus refreshed, report logged.`

### Step 5: Continuity Check

This workflow must explicitly verify Friday continuity.

Check and report:
- Friday daily closeout exists in `brain/reports/daily/`
- weekly report exists once lock-in completes
- if expected artifacts are missing, mark them as an operational gap rather than letting the failure stay silent

This is mandatory.

## State File Contract

Canonical path: `reports/weekly-review-state.json`

Suggested fields:
```json
{
  "week_start": "YYYY-MM-DD",
  "week_end": "YYYY-MM-DD",
  "status": "draft|pending_review|pending_confirmation|confirmed|skipped|error",
  "workflow": "weekly_review",
<!-- IF_EA -->
  "delivery_surface": "group-dm",
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
  "delivery_surface": "dm",
<!-- END_IF_NO_EA -->
  "draft_generated_at": "ISO-8601",
  "week_verdict": "mixed",
  "big_three": {},
  "triangle_summary": {
    "executive": [],
<!-- IF_EA -->
    "ea": [],
<!-- END_IF_EA -->
    "agent": []
  },
  "open_item_triage": [],
  "sacred_six_candidates": [],
  "confirmed_sacred_six": [],
  "next_week_focus": {
    "executive": [],
<!-- IF_EA -->
    "ea": [],
<!-- END_IF_EA -->
    "agent": []
  },
  "learnings_to_capture": [],
  "continuity_check": {
    "friday_daily_report_present": false,
    "weekly_report_present": false,
    "gaps": []
  },
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
  "notes": []
}
```

## Edge Cases

**Light week:** Be honest and flag strategic drift if the week generated motion without meaningful progress.

**Missing daily logs or reports:** Note the gap and work from what exists. Also flag it if it reflects workflow failure.

<!-- IF_EA -->
**No meaningful [EA_FIRST_NAME] tasks in DB:** Derive [EA_FIRST_NAME]'s weekly closeout and next-week focus from actual operating work.

<!-- END_IF_EA -->
**Existing confirmed weekly review for this week:** Do not regenerate unless explicitly requested.

**Nobody confirms:** Leave only the draft state file; do not write the report, Sacred Six updates, active focus refresh, checkpoint, or promotions.

## Trigger

This workflow should run with **full main-session context** and normal bootstrap access. Do **not** use `lightContext`.

<!-- IF_EA -->
It may be triggered by cron or manually in the group DM. The trigger should be thin: "Run Weekly Review." Routing/session details belong in cron or wrapper logic, not in the core skill definition.
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
It may be triggered by cron or manually in DM. The trigger should be thin: "Run Weekly Review." Routing/session details belong in cron or wrapper logic, not in the core skill definition.
<!-- END_IF_NO_EA -->

## References
- `references/report-template.md`
