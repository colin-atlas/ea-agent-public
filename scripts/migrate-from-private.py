#!/usr/bin/env python3
"""
One-shot migration: copy content from ~/atlas-ea-agent/ into kit/.
Run from the ea-agent-public repo root. Generates manifest.json for each component.
"""
from __future__ import annotations

import json
import os
import re
import shutil
from pathlib import Path

PRIVATE = Path.home() / "atlas-ea-agent"
KIT = Path("kit")

COMPONENTS = [
    # Identity
    {
        "id": "identity/workspace",
        "type": "identity",
        "version": "0.2.0",
        "description": "Full workspace identity templates (SOUL, USER, AGENTS, MEMORY, HEARTBEAT, TOOLS, IDENTITY).",
        "bundles": ["full-ea", "skills-only", "minimal"],
        "requires": {
            "components": [],
            "placeholders": [
                "AGENT_NAME", "AGENT_EMOJI",
                "EXECUTIVE_NAME", "EXECUTIVE_FIRST_NAME", "EXECUTIVE_ROLE",
                "EXECUTIVE_LOCATION", "EXECUTIVE_TIMEZONE",
                "COMPANY_NAME", "COMPANY_DESCRIPTION", "COMPANY_WEBSITE", "COMPANY_MISSION",
                "EXECUTIVE_CHANNEL_ID", "PRIMARY_CHANNEL",
            ],
            "env": [],
        },
        "files_map": {
            "SOUL-template.md": {"dest": "SOUL.md", "template": True},
            "USER-template.md": {"dest": "USER.md", "template": True},
            "AGENTS-template.md": {"dest": "AGENTS.md", "template": True},
            "MEMORY-template.md": {"dest": "MEMORY.md", "template": True},
            "HEARTBEAT-template.md": {"dest": "HEARTBEAT.md", "template": True},
            "TOOLS-template.md": {"dest": "TOOLS.md", "template": True},
            "IDENTITY-template.md": {"dest": "IDENTITY.md", "template": True},
        },
        "source_dir": "core/workspace",
    },
    # Brain
    {
        "id": "brain/knowledge-vault",
        "type": "brain",
        "version": "0.2.0",
        "description": "Obsidian-style knowledge vault: company context, team, security, workflows, escalation, goals.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": ["identity/workspace"],
            "placeholders": [
                "AGENT_NAME", "EXECUTIVE_NAME", "EXECUTIVE_FIRST_NAME",
                "COMPANY_NAME", "COMPANY_DESCRIPTION", "COMPANY_WEBSITE", "COMPANY_MISSION",
            ],
            "env": [],
        },
        "files_map": {
            "index-template.md": {"dest": "brain/index.md", "template": True},
            "knowledge/company-template.md": {"dest": "brain/knowledge/company.md", "template": True},
            "knowledge/ea-template.md": {"dest": "brain/knowledge/ea.md", "template": True},
            "knowledge/security-template.md": {"dest": "brain/knowledge/security.md", "template": False},
            "knowledge/escalation-template.md": {"dest": "brain/knowledge/escalation.md", "template": False},
            "knowledge/workflows-template.md": {"dest": "brain/knowledge/workflows.md", "template": False},
            "knowledge/big-three-goals-template.md": {"dest": "brain/knowledge/big-three-goals.md", "template": True},
            "knowledge/team-template.md": {"dest": "brain/knowledge/team.md", "template": True},
            "knowledge/task-management-protocol.md": {"dest": "brain/knowledge/task-management-protocol.md", "template": False},
            "projects/projects-template.md": {"dest": "brain/projects/projects.md", "template": True},
        },
        "source_dir": "core/brain",
    },
    # Memory scaffold
    {
        "id": "memory/scaffold",
        "type": "memory",
        "version": "0.2.0",
        "description": "Working memory scaffold: decisions, patterns, corrections starter files.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": ["identity/workspace"],
            "placeholders": [],
            "env": [],
        },
        "files_map": {
            "decisions.md": {"dest": "memory/decisions.md", "template": False},
            "patterns.md": {"dest": "memory/patterns.md", "template": False},
            "corrections.md": {"dest": "memory/corrections.md", "template": False},
        },
        "source_dir": "core/memory",
    },
    # Databases
    {
        "id": "db/tasks",
        "type": "db",
        "version": "0.2.0",
        "description": "Task management database: projects, tasks, tags, activity log, sacred six, alerts.",
        "bundles": ["full-ea", "skills-only", "dashboard-only"],
        "requires": {
            "components": [],
            "placeholders": ["AGENT_NAME"],
            "env": [],
        },
        "files_map": {
            "tasks.sql": {"dest": "db/tasks.db", "template": False},
        },
        "source_dir": "db/sqlite/schemas",
    },
    {
        "id": "db/auth",
        "type": "db",
        "version": "0.2.0",
        "description": "Dashboard authentication database: users and sessions.",
        "bundles": ["full-ea", "dashboard-only"],
        "requires": {
            "components": [],
            "placeholders": [],
            "env": [],
        },
        "files_map": {
            "auth.sql": {"dest": "db/auth.db", "template": False},
        },
        "source_dir": "db/sqlite/schemas",
    },
    # Scripts
    {
        "id": "scripts/google-api",
        "type": "scripts",
        "version": "0.2.0",
        "description": "Google API helper: OAuth token refresh, Calendar read, Gmail label management.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": [],
            "placeholders": [],
            "env": ["GOOGLE_REFRESH_TOKEN"],
        },
        "files_map": {
            "google-api.sh": {"dest": "scripts/google-api.sh", "template": False},
        },
        "source_dir": "core/scripts",
    },
    {
        "id": "scripts/fathom-api",
        "type": "scripts",
        "version": "0.2.0",
        "description": "Fathom API helper: list meetings, get transcripts and summaries.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": [],
            "placeholders": [],
            "env": ["FATHOM_API_KEY"],
        },
        "files_map": {
            "fathom-api.sh": {"dest": "scripts/fathom-api.sh", "template": False},
        },
        "source_dir": "core/scripts",
    },
    {
        "id": "scripts/tasks-cli",
        "type": "scripts",
        "version": "0.2.0",
        "description": "Task management CLI: list, add, update, filter, archive, search tasks.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": ["db/tasks"],
            "placeholders": [],
            "env": [],
        },
        "files_map": {
            "tasks.sh": {"dest": "scripts/tasks.sh", "template": False},
        },
        "source_dir": "db/sqlite/scripts",
    },
    {
        "id": "scripts/google-reauth",
        "type": "scripts",
        "version": "0.2.0",
        "description": "Google OAuth re-authentication: generate auth link, fetch and write tokens.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": [],
            "placeholders": [],
            "env": ["GOOGLE_CLIENT_ID", "GOOGLE_CLIENT_SECRET"],
        },
        "files_map": {
            "google-reauth.sh": {"dest": "scripts/google-reauth.sh", "template": False},
        },
        "source_dir": "core/scripts",
    },
    # Skills
    {
        "id": "skills/start-of-day-report",
        "type": "skills",
        "version": "0.2.0",
        "description": "Daily morning briefing: calendar review, task priorities, email highlights.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": ["identity/workspace", "db/tasks", "scripts/google-api", "scripts/tasks-cli"],
            "placeholders": ["EXECUTIVE_FIRST_NAME", "AGENT_NAME"],
            "env": [],
        },
        "source_dir": "core/skills/start-of-day-report",
        "copy_all": True,
    },
    {
        "id": "skills/end-of-day-report",
        "type": "skills",
        "version": "0.2.0",
        "description": "Daily closeout: task progress review, tomorrow planning, decision logging.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": ["identity/workspace", "db/tasks", "scripts/tasks-cli"],
            "placeholders": ["EXECUTIVE_FIRST_NAME", "AGENT_NAME"],
            "env": [],
        },
        "source_dir": "core/skills/end-of-day-report",
        "copy_all": True,
    },
    {
        "id": "skills/weekly-review",
        "type": "skills",
        "version": "0.2.0",
        "description": "Friday review: week retrospective, Big Three progress, next-week planning.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": ["identity/workspace", "db/tasks", "brain/knowledge-vault", "scripts/tasks-cli"],
            "placeholders": ["EXECUTIVE_FIRST_NAME", "AGENT_NAME"],
            "env": [],
        },
        "source_dir": "core/skills/weekly-review",
        "copy_all": True,
    },
    {
        "id": "skills/inbox-triage",
        "type": "skills",
        "version": "0.2.0",
        "description": "Gmail scan: classify, label, and triage inbox messages.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": ["identity/workspace", "scripts/google-api"],
            "placeholders": ["EXECUTIVE_FIRST_NAME"],
            "env": ["GOOGLE_REFRESH_TOKEN"],
        },
        "source_dir": "core/skills/inbox-triage",
        "copy_all": True,
    },
    {
        "id": "skills/meeting-prep",
        "type": "skills",
        "version": "0.2.0",
        "description": "Pre-meeting briefs: calendar scan, attendee lookup, context assembly.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": ["identity/workspace", "scripts/google-api"],
            "placeholders": ["EXECUTIVE_FIRST_NAME", "AGENT_NAME"],
            "env": [],
        },
        "source_dir": "core/skills/meeting-prep",
        "copy_all": True,
    },
    {
        "id": "skills/meeting-debrief",
        "type": "skills",
        "version": "0.2.0",
        "description": "Post-meeting processing: Fathom transcript to markdown debrief with action items.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": ["identity/workspace", "scripts/fathom-api", "brain/knowledge-vault"],
            "placeholders": ["EXECUTIVE_FIRST_NAME", "AGENT_NAME"],
            "env": ["FATHOM_API_KEY"],
        },
        "source_dir": "core/skills/meeting-debrief",
        "copy_all": True,
    },
    {
        "id": "skills/knowledge-audit",
        "type": "skills",
        "version": "0.2.0",
        "description": "Weekly workspace and brain vault audit: stale files, broken references, coverage gaps.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": ["identity/workspace", "brain/knowledge-vault", "memory/scaffold"],
            "placeholders": [],
            "env": [],
        },
        "source_dir": "core/skills/knowledge-audit",
        "copy_all": True,
    },
    {
        "id": "skills/security-maintenance",
        "type": "skills",
        "version": "0.2.0",
        "description": "Daily security audit: system health checks, prompt injection defense, log review.",
        "bundles": ["full-ea"],
        "requires": {
            "components": ["identity/workspace"],
            "placeholders": [],
            "env": [],
        },
        "source_dir": "core/skills/security-maintenance",
        "copy_all": True,
    },
    {
        "id": "skills/atlas-health-check",
        "type": "skills",
        "version": "0.2.0",
        "description": "Daily infrastructure health: container status, cron jobs, database integrity.",
        "bundles": ["full-ea"],
        "requires": {
            "components": ["identity/workspace", "db/tasks"],
            "placeholders": [],
            "env": [],
        },
        "source_dir": "core/skills/atlas-health-check",
        "copy_all": True,
    },
    # Cron
    {
        "id": "cron/schedule",
        "type": "cron",
        "version": "0.2.0",
        "description": "Central cron schedule for all skills: times, sessions, delivery targets, feature flags.",
        "bundles": ["full-ea", "skills-only"],
        "requires": {
            "components": [],
            "placeholders": ["EXECUTIVE_CHANNEL_ID", "EXECUTIVE_TIMEZONE"],
            "env": [],
        },
        "files_map": {
            "cron-manifest.json": {"dest": "cron-manifest.json", "template": True},
        },
        "source_dir": "core/cron",
    },
]


SANITIZE_RULES = [
    # Normalize hardcoded "MST" timezone to placeholder
    (r'"timezone":\s*"MST"', '"timezone": "[EXECUTIVE_TIMEZONE]"'),
    # Remove Atlas MCP reference if found
    (r'https://atlasassistants\.mintlify\.app/mcp', '[MCP_SERVER_URL]'),
]


def sanitize(text: str) -> str:
    for pattern, replacement in SANITIZE_RULES:
        text = re.sub(pattern, replacement, text)
    return text


def copy_component(comp: dict) -> None:
    cid = comp["id"]
    comp_dir = KIT / cid
    comp_dir.mkdir(parents=True, exist_ok=True)
    src_dir = PRIVATE / comp["source_dir"]

    if not src_dir.exists():
        print(f"  WARN: source dir {src_dir} does not exist, skipping")
        return

    files_list = []

    if comp.get("copy_all"):
        # Copy all files in source dir recursively (for skills with references/)
        for src_file in sorted(src_dir.rglob("*")):
            if src_file.is_file() and src_file.name != "skill.json":
                rel = src_file.relative_to(src_dir)
                dst_in_kit = comp_dir / rel
                dst_in_kit.parent.mkdir(parents=True, exist_ok=True)
                content = src_file.read_text()
                content = sanitize(content)
                dst_in_kit.write_text(content)
                # Determine workspace dest path
                ws_dest = f"skills/{cid.split('/')[-1]}/{rel}"
                is_template = bool(re.search(r"\[[A-Z][A-Z0-9_]*\]", content))
                files_list.append({
                    "src": str(rel),
                    "dest": ws_dest,
                    "template": is_template,
                })
    else:
        files_map = comp.get("files_map", {})
        for src_name, meta in files_map.items():
            src_path = src_dir / src_name
            if not src_path.exists():
                print(f"  WARN: {src_path} does not exist, skipping")
                continue
            dst_in_kit = comp_dir / src_name
            dst_in_kit.parent.mkdir(parents=True, exist_ok=True)
            content = src_path.read_text()
            content = sanitize(content)
            dst_in_kit.write_text(content)
            files_list.append({
                "src": src_name,
                "dest": meta["dest"],
                "template": meta.get("template", False),
            })

    # Generate manifest.json
    manifest = {
        "id": cid,
        "type": comp["type"],
        "version": comp["version"],
        "description": comp["description"],
        "bundles": comp["bundles"],
        "requires": comp["requires"],
        "files": files_list,
    }
    manifest_path = comp_dir / "manifest.json"
    manifest_path.write_text(json.dumps(manifest, indent=2) + "\n")
    print(f"  OK: {cid} ({len(files_list)} files)")


def update_bundles() -> None:
    bundles = {
        "full-ea": {
            "name": "Full EA",
            "description": "Everything — identity, all skills, all databases, brain, memory, cron, dashboard.",
            "components": [c["id"] for c in COMPONENTS if "full-ea" in c["bundles"]],
        },
        "skills-only": {
            "name": "Skills Only",
            "description": "Identity, skills, brain, memory, cron — no dashboard.",
            "components": [c["id"] for c in COMPONENTS if "skills-only" in c["bundles"]],
        },
        "dashboard-only": {
            "name": "Dashboard Only",
            "description": "Just the executive dashboard and required databases.",
            "components": [c["id"] for c in COMPONENTS if "dashboard-only" in c["bundles"]],
        },
        "minimal": {
            "name": "Minimal",
            "description": "Bootstrap identity only. Add skills later individually.",
            "components": [c["id"] for c in COMPONENTS if "minimal" in c["bundles"]],
        },
    }
    bundles_path = KIT / "bundles.json"
    bundles_path.write_text(json.dumps({"bundles": bundles}, indent=2) + "\n")
    summary = ", ".join(f"{k}({len(v['components'])})" for k, v in bundles.items())
    print(f"\n  Updated bundles.json: {summary}")


def main() -> None:
    print("Migrating from", PRIVATE)
    print("Writing to", KIT.resolve())
    print()

    for comp in COMPONENTS:
        copy_component(comp)

    update_bundles()

    print("\nDone. Run ./scripts/validate-manifests.sh to check.")


if __name__ == "__main__":
    main()
