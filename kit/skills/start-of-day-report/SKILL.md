---
name: start-of-day-report
<!-- IF_EA -->
description: "Daily ops lock-in for [EXECUTIVE_FIRST_NAME], [EA_FIRST_NAME], and [AGENT_NAME]. Use when running the weekday SOD / morning briefing / start-of-day alignment workflow. Produces a draft day plan, handles review in the group DM, and writes durable updates only after [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms."
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
description: "Daily ops lock-in for [EXECUTIVE_FIRST_NAME] and [AGENT_NAME]. Use when running the weekday SOD / morning briefing / start-of-day alignment workflow. Produces a draft day plan, handles review in DM, and writes durable updates only after [EXECUTIVE_FIRST_NAME] confirms."
<!-- END_IF_NO_EA -->
---

# Start of Day Report

<!-- IF_EA -->
SOD is a **daily ops lock-in workflow** for the operating triangle:
- [EXECUTIVE_FIRST_NAME]
- [EA_FIRST_NAME]
- [AGENT_NAME]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
SOD is a **daily ops lock-in workflow** for:
- [EXECUTIVE_FIRST_NAME]
- [AGENT_NAME]
<!-- END_IF_NO_EA -->

It is not a recap workflow. Its job is to align today's priorities, ownership, dependencies, and risks.

## Write Contract

| Output | Target | When |
|--------|--------|------|
| **Primary:** Workflow state | `reports/sod-state.json` | On draft creation, revisions, and confirmation |
<!-- IF_EA -->
| **Primary:** Finalized SOD report | `brain/reports/daily/YYYY-MM-DD.md` (append) | Only after [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms |
| **Primary:** Task board updates | `db/tasks.db` via `./tasks` | Only after [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms |
| **Secondary:** Morning ops log | `memory/YYYY-MM-DD.md` (append) | Only after [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms |
| **Delivery:** Draft + revisions + lock-in confirmation | Group DM | During review workflow |
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
| **Primary:** Finalized SOD report | `brain/reports/daily/YYYY-MM-DD.md` (append) | Only after [EXECUTIVE_FIRST_NAME] confirms |
| **Primary:** Task board updates | `db/tasks.db` via `./tasks` | Only after [EXECUTIVE_FIRST_NAME] confirms |
| **Secondary:** Morning ops log | `memory/YYYY-MM-DD.md` (append) | Only after [EXECUTIVE_FIRST_NAME] confirms |
| **Delivery:** Draft + revisions + lock-in confirmation | DM | During review workflow |
<!-- END_IF_NO_EA -->

**Naming:** Report section: `## SOD Lock-In — [Day, Month Date]`. Lock-in section: `### Lock-In — [HH:MM [CLIENT_TZ_ABBREV]]`.
**Skip write when:** If nobody confirms, leave `reports/sod-state.json` in draft/pending state only. Do not write the daily report, task updates, or morning log.
<!-- IF_EA -->
**Authority:** [EXECUTIVE_FIRST_NAME] can confirm or modify everything. [EA_FIRST_NAME] can confirm operationally on [EXECUTIVE_FIRST_NAME]'s behalf. If [EA_FIRST_NAME] confirms, log it explicitly as "Confirmed by [EA_FIRST_NAME] on [EXECUTIVE_FIRST_NAME]'s behalf."
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
**Authority:** [EXECUTIVE_FIRST_NAME] can confirm or modify everything.
<!-- END_IF_NO_EA -->

## Before You Begin

Read `brain/knowledge/task-management-protocol.md` for the full task operating standard — especially the **Today's Focus** and **Sacred Six** sections. SOD lock-in is responsible for keeping both in sync with the task board.

## Workflow

### Step 0: Preflight

Before gathering anything:
1. Determine whether today is a weekday or weekend.
2. Read `reports/sod-state.json` if it exists.
3. If today's SOD is already `confirmed`, do not regenerate a duplicate unless explicitly asked.
4. If today's SOD is still in `draft`, `pending_review`, or `pending_confirmation`, resume from that state instead of starting over blindly.
5. If weekend and not explicitly asked for a full SOD, run weekend mode:
   - skip inbox/calendar-heavy planning
   - focus only on urgent carryovers, Monday prep, and anything time-sensitive
   - mark state as `skipped` or `weekend_mode`

### Step 1: Meeting-Link Check

Fetch today's calendar:
```bash
./scripts/google-api.sh --all calendar
```

Scan today's calendar for **actual meetings/calls only**.

Qualification rule:
- Treat an event as a meeting/call only if it includes **other attendees / participants**
- Do **not** flag solo task blocks, focus blocks, work blocks, reminders, or generic calendar holds
- Internal meetings are still included if they have other attendees

Link rule:
- Every qualifying meeting/call must have a conferencing link
- The link must appear in either the `description` field or the `location` field

<!-- IF_EA -->
If any qualifying meetings are missing links, DM [EA_FIRST_NAME] directly:
```text
Missing meeting links today:
- {Event Title} — {time}
  - Type: {internal|external|unknown}
  - Missing: Conferencing link not found in description or location
```

This is fire-and-forget. If it fails, continue anyway.
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
If any qualifying meetings are missing links, flag them in the draft:
```text
Missing meeting links today:
- {Event Title} — {time}
  - Missing: Conferencing link not found in description or location
```
<!-- END_IF_NO_EA -->

### Step 2: Gather Today's Inputs

Gather only planning-relevant inputs.

#### 2a. Today's shape
Use the same calendar response from Step 1:
- key meetings
- prep-required meetings
- deep-work windows
- schedule collisions

#### 2b. Inbox / attention flags
Preferred source:
```bash
cat inbox-triage/$(TZ="[CLIENT_TIMEZONE]" date +%Y-%m-%d)-am.md 2>/dev/null
```
Fallback:
```bash
./scripts/google-api.sh --all gmail "label:0-Needs-Attention" 5
```
Only surface items that matter today.

#### 2c. Carryovers / open loops
Do **not** generate a generic yesterday recap.
Instead, surface only:
- unresolved items from the prior SOD/EOD state
- overdue tasks that still matter today
- pending workflow items still in play

Sources to check:
- `reports/sod-state.json`
- `reports/eod-state.json`
- active tasks in `db/tasks.db`

#### 2d. Sacred Six focus
```bash
./tasks sacred-six
```
Summarize only the Sacred Six items relevant to today.

#### 2e. [EXECUTIVE_FIRST_NAME] candidate priorities
```bash
./tasks list --status today,in_progress,needs_review,backlog --limit 50
```
Before recommending Top 3s, first check for already-blocked work on the calendar and existing ownership in the task board.

Recommend [EXECUTIVE_FIRST_NAME]'s Top 3 based on:
- Sacred Six alignment
- time sensitivity
- unblock value
- strategic relevance
- already-scheduled work that still belongs to [EXECUTIVE_FIRST_NAME]

Rules:
- keep ownership aligned to the real assignee
- if a task is already blocked on a different day, do not recommend it for today unless there is a new urgency or explicit change
<!-- IF_EA -->
- if work belongs to [EA_FIRST_NAME] or is waiting on [EXECUTIVE_FIRST_NAME], do not list it under the wrong person's Top 3
<!-- END_IF_EA -->
- check whether drafted assets already exist before proposing new drafting work

<!-- IF_EA -->
#### 2f. [EA_FIRST_NAME] candidate priorities
Use a mix of:
- team injects
- active tasks owned by [EA_FIRST_NAME] when visible in `db/tasks.db`
- pending follow-up / coordination work implied by today's calendar, inbox, or current workflow state

If no explicit [EA_FIRST_NAME] tasks are in the DB, derive a practical Top 3 from today's operating needs and label them clearly as operational priorities.

<!-- END_IF_EA -->
#### 2g. [AGENT_NAME] candidate priorities
Recommend [AGENT_NAME]'s Top 3 based on:
- unblocking [EXECUTIVE_FIRST_NAME]
<!-- IF_EA -->
- supporting [EA_FIRST_NAME]'s execution
<!-- END_IF_EA -->
- advancing active priority projects
- clearing needs_review / follow-up items

#### 2h. Team injects
```bash
cat reports/sod-inject-$(TZ="[CLIENT_TIMEZONE]" date +%Y-%m-%d).md 2>/dev/null
```
If present, incorporate relevant items into priorities / dependencies instead of dumping them raw.

### Step 3: Produce Draft Ops Lock-In

Use `references/briefing-template.md`.

The draft must include:
- today's shape
- inbox / attention flags
- carryovers / open loops
- Sacred Six focus
- [EXECUTIVE_FIRST_NAME] Top 3
<!-- IF_EA -->
- [EA_FIRST_NAME] Top 3
<!-- END_IF_EA -->
- [AGENT_NAME] Top 3
- dependencies / handoffs
- risks / flags
- proposed lock-in

Update `reports/sod-state.json` with:
- today's date
- `status: "draft"`
- draft-generated timestamp
<!-- IF_EA -->
- proposed Top 3s for [EXECUTIVE_FIRST_NAME], [EA_FIRST_NAME], and [AGENT_NAME]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
- proposed Top 3s for [EXECUTIVE_FIRST_NAME] and [AGENT_NAME]
<!-- END_IF_NO_EA -->
- dependencies
- risks
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
**"Want any changes before we lock it in?"**

### Step 4: Handle Review

This workflow is collaborative.

<!-- IF_EA -->
- If [EA_FIRST_NAME] responds with changes, revise the plan, update `reports/sod-state.json`, and post an updated draft.
<!-- END_IF_EA -->
- If [EXECUTIVE_FIRST_NAME] responds with changes, revise the plan, update `reports/sod-state.json`, and post an updated draft.
- If either asks clarifying questions, answer and continue.
<!-- IF_EA -->
- If [EA_FIRST_NAME] confirms, treat it as operational confirmation on [EXECUTIVE_FIRST_NAME]'s behalf unless the requested plan clearly involves a strategic reprioritization that should go back to [EXECUTIVE_FIRST_NAME].
<!-- END_IF_EA -->

Use state transitions:
- first draft -> `draft`
- revisions in progress -> `pending_review`
- revised plan awaiting signoff -> `pending_confirmation`
- confirmed plan -> `confirmed`

### Step 5: Lock In

<!-- IF_EA -->
When [EXECUTIVE_FIRST_NAME] or [EA_FIRST_NAME] confirms:
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
When [EXECUTIVE_FIRST_NAME] confirms:
<!-- END_IF_NO_EA -->

1. Update `reports/sod-state.json`:
   - `status: "confirmed"`
<!-- IF_EA -->
   - `confirmed_by: "[EXECUTIVE_FIRST_NAME]" | "[EA_FIRST_NAME]"`
   - `confirmed_on_behalf_of: "[EXECUTIVE_FIRST_NAME]"` when [EA_FIRST_NAME] confirms
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
   - `confirmed_by: "[EXECUTIVE_FIRST_NAME]"`
<!-- END_IF_NO_EA -->
   - confirmation timestamp
   - changes from review

2. Reconcile the `today` column before setting the new lock-in:
   - clear stale `today` tasks that are no longer part of the confirmed lock-in
   - keep items that are still part of the confirmed plan
   - do **not** move completed (`done`) items back into `today`
   - if a confirmed priority does not yet exist as a task, create it before syncing status so the dashboard can represent it

3. Move confirmed task IDs to `today` using the canonical task CLI:
```bash
./tasks update <id> --status today
```
Rules:
- This step is required for SOD completion because dashboard Today's Focus reads from tasks with `status = 'today'`
- Skip any confirmed item already marked `done`
- If a confirmed priority is represented as an operating item rather than a task, either create a task for it or leave it out of Today's Focus explicitly in the log

4. Verify the sync result:
   - confirmed [EXECUTIVE_FIRST_NAME] Top 3 task entries should appear in `today` unless already `done`
   - confirmed [AGENT_NAME] Top 3 task entries should appear in `today` unless already `done`
   - stale `today` items removed from the lock-in should no longer remain in `today`

5. Append the finalized report to `brain/reports/daily/YYYY-MM-DD.md`:
```markdown
## SOD Lock-In — [Day, Month Date]

<!-- IF_EA -->
[FULL finalized SOD draft as posted in group DM]
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
[FULL finalized SOD draft as posted in DM]
<!-- END_IF_NO_EA -->

---

### Lock-In — [HH:MM [CLIENT_TZ_ABBREV]]

**[EXECUTIVE_FIRST_NAME] Top 3:**
1. #ID — Title
2. #ID — Title
3. #ID — Title

<!-- IF_EA -->
**[EA_FIRST_NAME] Top 3:**
1. {task / operating priority}
2. {task / operating priority}
3. {task / operating priority}

<!-- END_IF_EA -->
**[AGENT_NAME] Top 3:**
1. #ID — Title
2. #ID — Title
3. #ID — Title

**Dependencies / handoffs:**
- ...

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

6. Append a concise ops log to `memory/YYYY-MM-DD.md`:
```markdown
## Morning Ops Lock-In [HH:MM UTC]

**[EXECUTIVE_FIRST_NAME] Top 3:**
1. ...
2. ...
3. ...

<!-- IF_EA -->
**[EA_FIRST_NAME] Top 3:**
1. ...
2. ...
3. ...

<!-- END_IF_EA -->
**[AGENT_NAME] Top 3:**
1. ...
2. ...
3. ...

**Key decisions:** [if any]
**Dependencies:** [if any]
**Open items:** [if any]
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
- `Plan locked in. Task board updated, report logged.`

### Step 6: Cleanup

If a same-day SOD inject file was consumed and is no longer needed, remove it after the finalized SOD is posted so it does not get reused.

## State File Contract

Canonical path: `reports/sod-state.json`

Suggested fields:
```json
{
  "date": "YYYY-MM-DD",
  "status": "draft|pending_review|pending_confirmation|confirmed|skipped|error|weekend_mode",
  "workflow": "sod",
<!-- IF_EA -->
  "delivery_surface": "group-dm",
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
  "delivery_surface": "dm",
<!-- END_IF_NO_EA -->
  "draft_generated_at": "ISO-8601",
  "draft_message_summary": {
    "executive_top_3": [],
<!-- IF_EA -->
    "ea_top_3": [],
<!-- END_IF_EA -->
    "agent_top_3": []
  },
  "carryovers": [],
  "dependencies": [],
  "risks": [],
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

**Weekend:** Run weekend mode unless a full SOD is explicitly requested.

**Calendar unavailable:** Still produce SOD with schedule section marked unavailable.

**Inbox unavailable:** Still produce SOD with inbox section marked unavailable.

<!-- IF_EA -->
**No meaningful [EA_FIRST_NAME] tasks in DB:** Derive [EA_FIRST_NAME]'s Top 3 from today's operating needs and label them as operational priorities.

<!-- END_IF_EA -->
**Existing confirmed SOD for today:** Do not regenerate unless explicitly requested.

**Nobody confirms:** Leave only the draft state file; do not write the report, task board updates, or memory log.

## Trigger

<!-- IF_EA -->
This skill may be triggered by cron or manually in the group DM. The trigger should be thin: "Run Start of Day." Routing/session details belong in cron or wrapper logic, not in the core skill definition.
<!-- END_IF_EA -->
<!-- IF_NO_EA -->
This skill may be triggered by cron or manually in DM. The trigger should be thin: "Run Start of Day." Routing/session details belong in cron or wrapper logic, not in the core skill definition.
<!-- END_IF_NO_EA -->

## References
- `references/briefing-template.md`
