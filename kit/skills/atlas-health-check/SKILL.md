---
name: atlas-health-check
description: "Daily operational health report for the Atlas team. Checks container status, cron job health, database integrity, memory system, workspace integrity, and integration connectivity. Delivers to Atlas monitoring channel via announce delivery."
---

# Atlas Health Check

**Purpose:** Daily operational health report for the Atlas team. Runs as an isolated cron job and delivers results to the Atlas monitoring Slack channel via announce delivery.

**Audience:** Atlas team only (not the client). Always report — even on all-clear days.

---

## Write Contract

| Output | Target | When |
|--------|--------|------|
| **Primary:** Health report | Announce delivery to Atlas Slack channel | Every run |

**Skip write when:** Never — always deliver a report, even on all-clear days.

---

## Execution Steps

### Step 1: Gather Health Data

Run the following checks and collect results:

**1a. Cron Job Status**
- Run: `openclaw cron list --json`
- Count total jobs, enabled jobs, disabled jobs
- For each job, check if `lastRunAtMs` exists and whether last status was success or failure
- Flag any jobs that haven't run in 48+ hours (weekday jobs only)
- Flag any jobs with error status in their last run

**1b. Database Health**
- Check database files exist and are readable:
  - `db/tasks.db`
- For `tasks.db`: count active tasks (status not in archive/done)
- Report any missing or empty databases

**1c. Memory System**
- Read `MEMORY.md` — report file size (warn if >6KB, approaching 8KB limit)
- Check `memory/` directory — count recent daily logs (last 7 days)
- Flag if no daily logs exist for 3+ consecutive weekdays (suggests memory flush not working)

**1d. Workspace Integrity**
- Verify critical files exist: `SOUL.md`, `AGENTS.md`, `USER.md`, `MEMORY.md`, `HEARTBEAT.md`
- Verify `skills/` directory has expected skill count (6+ directories with SKILL.md)
- Verify `scripts/` directory has helper scripts

**1e. Integration Connectivity** (check what's configured, don't make live API calls)
- Check if `scripts/google-api.sh` exists (Google OAuth configured)
- Check if `scripts/fathom-api.sh` exists (Fathom configured)
- Note: actual API health is validated by the skills themselves during execution

### Step 2: Format Report

Use this format:

```
## [AGENT_NAME] Health Check — {date}

**Status:** {HEALTHY | DEGRADED | DOWN}

### Cron Jobs
- Total: {n} | Active: {n} | Failed last run: {n}
- {list any problematic jobs with details}

### Databases
- tasks.db: {n} active tasks
- {flag any issues}

### Memory
- MEMORY.md: {size} ({OK | WARNING: approaching limit})
- Daily logs: {n} in last 7 days
- People files: {n} in memory/people/
- Debrief files: {n} in brain/meetings/debriefs/

### Workspace
- Identity files: OK
- Skills: {n} installed
- Scripts: OK

### Notes
- {any observations, warnings, or recommended actions}
- {or: "All systems nominal."}
```

**Status criteria:**
- **HEALTHY:** All checks pass, no warnings
- **DEGRADED:** Non-critical warnings (memory approaching limit, a cron job failed once, missing daily logs)
- **DOWN:** Critical issues (databases missing, identity files gone, multiple cron failures)

### Step 3: Deliver

This skill uses `announce` delivery on an isolated session — OpenClaw delivers the output automatically to the configured Atlas Slack channel. Simply output the formatted report as your response.

---

## Edge Cases

- **First run after deployment:** Some checks will show "no history" — this is expected. Report as HEALTHY with a note.
- **No cron jobs registered:** Report as DEGRADED with note to check `register-crons.sh` execution.
- **File permission errors:** Report the specific files/dirs that are inaccessible.

---

## Schedule

Daily, 6am local time, weekdays. Runs before client-facing skills so Atlas team sees any issues before the client does.
