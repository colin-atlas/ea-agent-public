# Components

This document describes every component in the Atlas EA kit. Components are the installable units — each has a `manifest.json`, content files, and optional dependencies.

**19 components total** across 7 types: identity, brain, memory, db, scripts, skills, cron.

---

## Identity

### identity/workspace

Full workspace identity templates: SOUL.md, USER.md, AGENTS.md, MEMORY.md, HEARTBEAT.md, TOOLS.md, IDENTITY.md. Personalizes your agent with your name, role, company, timezone, and communication style.

**Bundles:** Full EA, Skills Only, Minimal
**Placeholders:** AGENT_NAME, AGENT_EMOJI, EXECUTIVE_NAME, EXECUTIVE_FIRST_NAME, EXECUTIVE_ROLE, EXECUTIVE_LOCATION, EXECUTIVE_TIMEZONE, COMPANY_NAME, COMPANY_DESCRIPTION, COMPANY_WEBSITE, COMPANY_MISSION, EXECUTIVE_CHANNEL_ID, PRIMARY_CHANNEL

---

## Brain

### brain/knowledge-vault

Obsidian-style knowledge vault: company context, team directory, security policies, workflows, escalation procedures, quarterly goals, and project tracking. Indexed by QMD for semantic search during skill execution.

**Bundles:** Full EA, Skills Only
**Depends on:** identity/workspace
**Placeholders:** AGENT_NAME, EXECUTIVE_NAME, EXECUTIVE_FIRST_NAME, COMPANY_NAME, COMPANY_DESCRIPTION, COMPANY_WEBSITE, COMPANY_MISSION, VENDOR_NAME, VENDOR_SUPPORT_EMAIL, VENDOR_DOCS_URL, VENDOR_PORTAL_URL

---

## Memory

### memory/scaffold

Working memory starter files: `decisions.md`, `patterns.md`, `corrections.md`. Your agent populates these over time as it learns your preferences, makes key decisions, and corrects mistakes.

**Bundles:** Full EA, Skills Only
**Depends on:** identity/workspace

---

## Databases

### db/tasks

Task management database: projects, tasks, tags, activity log, sacred six history, and alerts. Core data store used by most skills and the executive dashboard.

**Bundles:** Full EA, Skills Only, Dashboard Only

### db/auth

Dashboard authentication database: users and sessions tables. Only needed when installing the executive dashboard.

**Bundles:** Full EA, Dashboard Only

---

## Scripts

### scripts/google-api

Google API helper shell script: OAuth token refresh, Calendar read/write, Gmail label management. Required by any skill that touches Google Calendar or Gmail.

**Bundles:** Full EA, Skills Only
**Env:** GOOGLE_REFRESH_TOKEN

### scripts/fathom-api

Fathom meeting transcript API helper. Lists recent meetings, fetches transcripts and summaries. Required by the meeting-debrief skill.

**Bundles:** Full EA, Skills Only
**Env:** FATHOM_API_KEY

### scripts/tasks-cli

Task management CLI (`./tasks list`, `./tasks add`, `./tasks update`, etc.). Required by SOD, EOD, and weekly-review skills for querying and updating tasks.

**Bundles:** Full EA, Skills Only
**Depends on:** db/tasks

### scripts/google-reauth

Google OAuth re-authentication flow. Run this when your Google tokens expire — generates an auth link, then fetches and writes new tokens.

**Bundles:** Full EA, Skills Only
**Env:** GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET

---

## Skills

### skills/start-of-day-report

Daily morning briefing at 7am: reviews today's calendar, surfaces task priorities, highlights important emails. Requires Google Calendar access.

**Bundles:** Full EA, Skills Only
**Depends on:** identity/workspace, db/tasks, scripts/google-api, scripts/tasks-cli
**Placeholders:** EXECUTIVE_FIRST_NAME, AGENT_NAME

### skills/end-of-day-report

Daily closeout at 4pm: reviews task progress, locks in tomorrow's plan, logs key decisions to memory.

**Bundles:** Full EA, Skills Only
**Depends on:** identity/workspace, db/tasks, scripts/tasks-cli
**Placeholders:** EXECUTIVE_FIRST_NAME, AGENT_NAME

### skills/weekly-review

Friday 4pm review: week retrospective, Big Three goal progress check, next-week planning session.

**Bundles:** Full EA, Skills Only
**Depends on:** identity/workspace, db/tasks, brain/knowledge-vault, scripts/tasks-cli
**Placeholders:** EXECUTIVE_FIRST_NAME, AGENT_NAME

### skills/inbox-triage

Gmail scan 2x daily: classifies emails, applies labels, writes a triage log. Requires Gmail API access with `gmail.modify` scope.

**Bundles:** Full EA, Skills Only
**Depends on:** identity/workspace, scripts/google-api
**Placeholders:** EXECUTIVE_FIRST_NAME
**Env:** GOOGLE_REFRESH_TOKEN

### skills/meeting-prep

Pre-meeting briefs at 3pm: scans tomorrow's calendar, looks up attendees, assembles context from brain vault.

**Bundles:** Full EA, Skills Only
**Depends on:** identity/workspace, scripts/google-api
**Placeholders:** EXECUTIVE_FIRST_NAME, AGENT_NAME

### skills/meeting-debrief

Polls Fathom every 30 minutes for new meeting transcripts, writes structured markdown debriefs with action items and decisions.

**Bundles:** Full EA, Skills Only
**Depends on:** identity/workspace, scripts/fathom-api, brain/knowledge-vault
**Placeholders:** EXECUTIVE_FIRST_NAME, AGENT_NAME
**Env:** FATHOM_API_KEY

### skills/knowledge-audit

Friday 5pm audit of workspace and brain vault: finds stale files, broken references, and coverage gaps in your agent's knowledge.

**Bundles:** Full EA, Skills Only
**Depends on:** identity/workspace, brain/knowledge-vault, memory/scaffold

### skills/security-maintenance

Daily 5am security audit: system health checks, prompt injection pattern review, security log analysis.

**Bundles:** Full EA only
**Depends on:** identity/workspace

### skills/atlas-health-check

Daily 6am infrastructure health check: container status, cron job validation, database integrity checks.

**Bundles:** Full EA only
**Depends on:** identity/workspace, db/tasks

---

## Cron

### cron/schedule

Central cron manifest (`cron-manifest.json`) defining schedules for all skills. Includes session type (main/isolated), delivery channel targets, feature flags, and timezone-aware scheduling.

**Bundles:** Full EA, Skills Only
**Placeholders:** EXECUTIVE_CHANNEL_ID, EXECUTIVE_TIMEZONE

---

## Bundle summary

| Bundle | Components included |
|---|---|
| Full EA | All 19 components |
| Skills Only | identity/workspace, brain/knowledge-vault, memory/scaffold, db/tasks, scripts/google-api, scripts/fathom-api, scripts/tasks-cli, scripts/google-reauth, all 9 skills, cron/schedule |
| Dashboard Only | db/tasks, db/auth |
| Minimal | identity/workspace |
