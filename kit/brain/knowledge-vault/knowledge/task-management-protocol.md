# Task Management Protocol

> How tasks flow between the executive, the agent, and AI sub-agents. This is the operating standard for all task work.

---

## Task Lifecycle

```
Backlog → Today → In Progress → Needs Review → Done
                       ↓
                    Blocked                   Archive
```

| Status | Meaning |
|--------|---------|
| **Backlog** | Task exists, not yet started |
| **Today** | Locked in as a daily priority during SOD — drives dashboard Today's Focus |
| **In Progress** | Plan aligned, actively being worked on |
| **Blocked** | Can't proceed — blocker documented in task notes |
| **Needs Review** | Work complete, awaiting reviewer sign-off with summary |
| **Done** | Reviewer confirmed, closed |
| **Archive** | Cancelled or no longer relevant |

---

## Task Properties

Every task should have:
- **Title** — Clear, action-oriented
- **Priority** — P1 (urgent), P2 (important), P3 (normal), P4 (low)
- **Owner** — Who's responsible for delivery
- **Project** — Which project it belongs to
- **Description** — What needs to be done (filled when task is created)
- **Notes** — Living doc: plan, progress updates, completion summary

---

## Workflow: Executive → Agent

1. **Executive assigns task** → Agent adds to board as **Backlog**
2. **Plan & align** → Agent drafts a plan, adds to task notes, discusses with executive
3. **Plan approved** → Agent moves to **In Progress**, begins work
4. **Work complete** → Agent moves to **Needs Review**, shares completion summary
5. **Executive reviews** → Confirms done or requests changes
6. **Confirmed** → Agent moves to **Done**

### Rules for the Agent
- Never skip to Done — always go through Needs Review
- Always document the plan in task notes before starting
- Always share a completion summary when moving to Needs Review
- If blocked, document the blocker and surface it proactively
- Provide progress updates on long-running tasks

---

## Workflow: Agent → AI Sub-Agents

When the agent delegates to sub-agents:

1. **Agent creates task** → Assigns to sub-agent, status **Backlog**
2. **Agent briefs sub-agent** → Provides context, acceptance criteria, adds plan to notes
3. **Sub-agent works** → Status **In Progress**
4. **Sub-agent completes** → Moves to **Needs Review** with output
5. **Agent reviews** → Validates quality and completeness
6. **If good** → Agent moves to **Done** (or escalates to executive if input needed)
7. **If not good** → Agent sends back with feedback, sub-agent revises

### Escalation to Executive
The agent only escalates to the executive when:
- Task requires executive's specific decision or approval
- Output has strategic implications
- Agent work touches external-facing content or communications
- Agent is unsure about quality or direction

Everything else, the agent reviews and closes independently.

---

## Workflow: Executive → AI Sub-Agents (via Agent)

The executive never assigns directly to sub-agents. The flow is always:

```
Executive → Agent → Sub-Agent → Agent → Executive (if needed)
```

The agent is the single point of accountability. This ensures:
- Quality control before anything reaches the executive
- Consistent task tracking and documentation
- Executive's time is protected from agent noise

---

## Comments

Use task comments for handoff notes, review feedback, and status updates. Comments are threaded and attributed to the author (from auth session or CLI).

- When moving to **Needs Review**, add a completion summary as a **comment** (not in notes)
- Use comments for back-and-forth discussion on a task
- Comments are visible in the task detail sheet and via `tasks.sh show <id>`
- CLI: `tasks.sh comment <id> "message"` — adds comment with actor from `$TASK_ACTOR` env or "CLI"

---

## Checklists

For multi-step tasks, create a checklist before starting. Update progress as you work.

- Checklist progress is visible on the Kanban card (e.g., "3/5")
- The task detail sheet shows interactive checkboxes — click to toggle without editing
- In edit mode, add/remove/reorder checklist items
- CLI: `tasks.sh checklist <id> add "item"` and `tasks.sh checklist <id> toggle <index>`

---

## Due Dates

Always set due dates for P1 and P2 tasks.

- **Overdue tasks** surface in the Needs Attention section of the dashboard and show **red badges** on the Kanban board
- **Due today** tasks show **amber badges**
- **Future** due dates show gray with the date
- The home dashboard shows an "Overdue" subsection in Needs Attention

---

## Blocked Tasks

When a task is blocked:
1. Move to **Blocked** status immediately
2. Set the **blocked_by** reference to the blocking task and fill in **blocked_reason** so the dashboard shows the dependency chain
3. Document in task notes: what's blocking, who can unblock, and what's needed
4. Surface to the executive in the next briefing or proactively if urgent
5. Check blocked tasks daily — don't let them rot

---

## Today's Focus — SOD Lock-In Workflow

The `today` status is the bridge between the morning SOD lock-in and the dashboard.

### How it works
1. During the **Start of Day** workflow, the executive's Top 3 and the agent's Top 3 are proposed and reviewed.
2. Once the executive or EA confirms the SOD, the confirmed Top 3 tasks move to `today`.
3. Stale `today` items from the previous day that aren't part of today's lock-in get moved back to `backlog` or `in_progress` as appropriate.
4. Items already marked `done` are skipped — they don't move back to `today`.
5. If a confirmed priority doesn't exist as a task yet, create it before syncing.

### Why it matters
- The dashboard's **Today's Focus** widget reads from `status = 'today'`.
- If the task board isn't updated after SOD, the dashboard shows stale priorities.
- SOD is not considered complete until the task board reflects the lock-in.

### Rules
- Only the SOD lock-in workflow should bulk-set tasks to `today`.
- Moving a task to `in_progress` when actively working on it is fine — it stays visible.
- At EOD, any `today` items not started can be flagged as carryovers.

---

## Sacred Six — Weekly Priority Workflow

Sacred Six = the **executive's** top 6 priorities for the week. It is NOT a team-wide list.

### How it works
1. Sacred Six is set during **Weekly Review/Planning** or at the start of the week.
2. Once confirmed, each item must exist as a task in `db/tasks.db` and be tagged `sacred-six`.
3. Old `sacred-six` tags from the prior week's completed items are removed first.
4. Items already completed at lock-in time are tagged but left as `done`.

### Why it matters
- The dashboard's **Sacred Six** widget reads from the `sacred-six` tag.
- If the tag isn't applied, the dashboard shows stale or empty data.
- Sacred Six lock-in is not complete until the task board is updated.

### Accountability
- The agent and EA track Sacred Six progress and ensure the executive completes them week over week.
- Daily SODs should reference Sacred Six alignment when proposing the executive's Top 3.
- Weekly Review should assess: how many of the 6 were completed? What carried over? Why?

---

## Auto-Archive

Tasks in **done** status auto-archive after 7 days. This runs daily as part of the security-maintenance skill.

---

## Task Hygiene

- **Daily:** Review active tasks, update statuses, surface blockers
- **Weekly:** Review backlog, reprioritize, archive stale tasks
- **Per session:** Check task board at session start, update before session end
- **No orphan tasks:** Every task has an owner and a project
- **No stale In Progress:** If something's been in progress for 3+ days with no update, flag it

---

## Priority Definitions

| Priority | Meaning | Response Time |
|----------|---------|---------------|
| **P1** | Urgent + important — do now | Same day |
| **P2** | Important — do this week | Within 2-3 days |
| **P3** | Normal — do when capacity allows | Within 1-2 weeks |
| **P4** | Low — nice to have | When convenient |

---

## Template: Task Notes Structure

```
## Plan
- [What we're going to do]
- [How we're going to do it]
- [Acceptance criteria]

## Progress
- [Date]: [Update]

## Completion Summary
- [What was done]
- [What was deferred]
- [Any follow-ups needed]
```

---

*This protocol applies to all task work across the team. When onboarding new agents, share this document as part of their operating context.*
