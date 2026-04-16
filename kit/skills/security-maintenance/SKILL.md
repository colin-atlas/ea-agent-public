---
name: security-maintenance
description: "Daily security and infrastructure health audit. Checks system updates, failed logins, disk/memory, services, firewall, Tailscale, open ports, dependency vulnerabilities, credential exposure, command injection risks, gateway auth, and injection attempts. Alerts [EXECUTIVE_FIRST_NAME] only when something needs attention. Monthly deep audit on the 1st."
---

# Security Maintenance

## Write Contract

| Output | Target | When |
|--------|--------|------|
| **Primary:** Security log | `security-logs/YYYY-MM-DD.md` (always) | Every run |
| **Primary:** Task auto-archive | `db/tasks.db` (done 7+ days -> archive) | Every run |
| **Secondary:** Weekly summary | `memory/YYYY-MM-DD.md` (append) | Fridays only |
| **Delivery:** Alert | Announce delivery (isolated session) | Warnings/criticals only — NO_REPLY on all-clear |

**Naming:** Log: `security-logs/YYYY-MM-DD.md`. Section: `# Security Audit — YYYY-MM-DD HH:MM UTC`.
**Skip write when:** Never skip the security log. Skip DM delivery (NO_REPLY) on all-clear days. Gateway auth warning only in weekly/monthly summaries.

---

## Before you begin
Read these files for context:
- brain/knowledge/security.md (security rules and threat patterns)
- MEMORY.md (infrastructure details — IPs, ports, services)

Daily automated security and infrastructure health check. Runs silently — only alerts when something needs attention.

---

## Step 1 — Run All Checks

Run each check and collect results. Classify each as OK, Warning, or Critical.

### 1a. System Updates

```bash
apt list --upgradable 2>/dev/null | grep -v "Listing"
```

- OK: No pending updates
- Warning: 1-5 pending non-security updates
- Critical: Any security updates pending, or 10+ total pending

```bash
cat /etc/apt/apt.conf.d/20auto-upgrades
tail -5 /var/log/unattended-upgrades/unattended-upgrades.log 2>/dev/null
```

### 1b. Failed Login Attempts

```bash
journalctl -u ssh --no-pager -q --since "24 hours ago" 2>/dev/null | grep -i "failed\|invalid" | wc -l
journalctl -u ssh --no-pager -q --since "24 hours ago" 2>/dev/null | grep -i "failed\|invalid" | grep -oP '\d+\.\d+\.\d+\.\d+' | sort -u
last -10 2>/dev/null
```

- OK: 0 failed attempts
- Warning: 1-10 failed attempts (likely bots if SSH is Tailscale-only)
- Critical: 10+ failed attempts or attempts from Tailscale IPs

Note: Agent may not have sudo — if journalctl fails due to permissions, note it.

### 1c. Disk Usage

```bash
df -h / | tail -1
du -sh ~/.openclaw/workspace/ 2>/dev/null
du -sh ~/.openclaw/workspace/db/ 2>/dev/null
```

- OK: Under 70%
- Warning: 70-85%
- Critical: Over 85%

### 1d. Memory

```bash
free -h | head -2
```

- OK: Available > 2GB
- Warning: Available 1-2GB
- Critical: Available < 1GB

### 1e. Services Health

```bash
systemctl is-active tailscaled
systemctl is-active ssh
systemctl is-active executive-dashboard
systemctl is-active unattended-upgrades
openclaw gateway status 2>/dev/null
```

- OK: All services active
- Critical: Any service inactive/failed

### 1f. Firewall & Ports

```bash
ss -tlnp 2>/dev/null | grep LISTEN
```

Compare against expected ports (documented in MEMORY.md or brain/knowledge/security.md).

- OK: Only expected ports open, all bound correctly
- Critical: Unexpected port open, or service bound to 0.0.0.0 that shouldn't be

### 1g. Tailscale

```bash
tailscale status 2>/dev/null
```

- OK: Connected, peers visible
- Critical: Disconnected or no peers

### 1h. OpenClaw Version

```bash
openclaw --version 2>/dev/null
npm view openclaw version 2>/dev/null
```

- OK: On latest version
- Warning: Update available (note version)
- For major updates: note only, don't recommend auto-update

### 1i. Secrets File Permissions

```bash
ls -la ~/.openclaw/secrets/ 2>/dev/null
```

- OK: All files chmod 600, correct owner
- Critical: Any file world-readable or wrong owner

### 1j. Uptime & Load

```bash
uptime
```

- OK: Load average < 2.0
- Warning: Load average 2.0-4.0
- Critical: Load average > 4.0 or uptime suggests unexpected reboot

### 1k. Dependency Vulnerabilities (npm audit)

```bash
# OpenClaw
cd ~/.npm-global/lib/node_modules/openclaw && npm audit --production 2>/dev/null | tail -5

# Executive Dashboard
cd ~/.openclaw/workspace/executive-dashboard && npm audit --production 2>/dev/null | tail -5
```

- OK: 0 vulnerabilities
- Warning: Low/moderate vulnerabilities only
- Critical: High or critical vulnerabilities found

### 1l. Credential Exposure Scan

Scan workspace files and logs for accidentally leaked secrets:

```bash
cd ~/.openclaw/workspace

# Scan for common key patterns
grep -rl "sk-ant-\|ya29\." --include="*.md" --include="*.log" --include="*.json" \
  memory/ brain/reports/ brain/meetings/ inbox-triage/ security-logs/ 2>/dev/null | grep -v "node_modules"

# Scan for generic API keys
grep -rlP "(api[_-]?key|token|secret|password)\s*[:=]\s*['\"]?[A-Za-z0-9_\-]{20,}" --include="*.md" --include="*.log" \
  memory/ brain/reports/ brain/meetings/ inbox-triage/ security-logs/ 2>/dev/null | grep -v "node_modules"
```

**Exclude from scan:**
- `~/.openclaw/secrets/` (that's where keys belong)
- `node_modules/`

- OK: No credentials found in logs/reports/memory files
- Critical: Credential found outside secrets directory — report exact file and line

If a leak is found:
1. Report the file path and which credential type
2. Do NOT include the credential value in the alert
3. Recommend: rotate the key + remove from the file

### 1m. Gateway Auth Status

```bash
python3 -c "
import json
with open('$HOME/.openclaw/openclaw.json') as f:
    config = json.load(f)
auth = config.get('gateway', {}).get('auth', {})
print('Auth configured:', bool(auth))
" 2>/dev/null
```

- Warning: No token auth configured (standing reminder)
- OK: Token auth enabled

This is a known accepted risk. Log it but don't alert daily — only include in the **weekly summary** and **monthly audit**.

### 1n. Injection Attempt Log Review

```bash
grep -l "injection\|SECURITY ALERT\|injection attempt\|hijack" \
  ~/.openclaw/workspace/memory/$(date +%Y-%m)*.md 2>/dev/null
```

- OK: No injection attempts logged
- Warning: Injection attempt was logged — review details
- Critical: Sophisticated or repeated injection attempts — escalate

### 1o. Shell Script Injection Audit

```bash
cd ~/.openclaw/workspace
grep -n '[^"]\$[A-Z_]\+[^"]\|`\$\|$(\$' scripts/*.sh 2>/dev/null | head -20
grep -n 'eval ' scripts/*.sh 2>/dev/null
```

- OK: All variables properly quoted, no eval usage
- Warning: Unquoted variables found (potential injection vector)
- Critical: eval with external input, or SQL injection risk

This is a **weekly check only** (Fridays) — scripts don't change daily.

---

## Step 1p — Auto-Archive Done Tasks

Archive tasks that have been in done status for 7+ days:

```bash
sqlite3 db/tasks.db "SELECT id, title FROM tasks WHERE status='done' AND completed_at < datetime('now', '-7 days');"
```

If any tasks found, archive them:

```bash
sqlite3 db/tasks.db "
  INSERT INTO activity_log (entity_type, entity_id, action, details, actor)
    SELECT 'task', id, 'status_changed', title || ': done -> archive (auto)', '[AGENT_NAME]'
    FROM tasks WHERE status='done' AND completed_at < datetime('now', '-7 days');
  UPDATE tasks SET status='archive' WHERE status='done' AND completed_at < datetime('now', '-7 days');
"
```

---

## Step 2 — Assess Overall Status

Count results:
- **All Green** -> no alert needed, log silently
- **Any Warning** -> log + alert with summary
- **Any Critical** -> log + alert immediately with details and recommended action

**Severity priority:** Report highest severity first.

---

## Step 3 — Log Results

Always write results to:
```
security-logs/YYYY-MM-DD.md
```

Format:
```markdown
# Security Audit — YYYY-MM-DD HH:MM UTC

**Overall: ALL CLEAR** (or WARNINGS or CRITICAL)

| Check | Status | Details |
|-------|--------|---------|
| System Updates | OK | No pending updates |
| Failed Logins | OK | 0 attempts |
| Disk Usage | OK | X% used |
| Memory | OK | XG available |
| Services | OK | All active |
| Firewall/Ports | OK | Expected ports only |
| Tailscale | OK | Connected |
| OpenClaw | OK | vX.X.X (latest) |
| Secrets Perms | OK | All 600, correct owner |
| Load | OK | X.XX avg |
| npm audit | OK | 0 vulnerabilities |
| Credential Scan | OK | No leaks found |
| Gateway Auth | Warning | No token auth (deferred) |
| Injection Log | OK | No attempts logged |
| Script Audit | OK | (Fridays only) |

**Notes:** [any additional observations]
```

---

## Step 4 — Alert (if needed)

**Delivery is handled automatically by OpenClaw's announce system.** Your final reply text becomes the alert.

### Warning Alert
```
Security Check — [count] warnings

[bullet list of warnings with details]

Full log: security-logs/YYYY-MM-DD.md
```

### Critical Alert
```
Security Alert — action needed

[details]

Recommended action:
[what to do]

Full log: security-logs/YYYY-MM-DD.md
```

### All Clear
Reply with only: NO_REPLY
This suppresses delivery.

---

## Step 5 — Weekly Summary (Fridays only)

On Fridays, run the full check set (including 1o Script Audit) and generate a weekly summary.

---

## Step 6 — Monthly Deep Audit (1st of each month)

On the 1st of the month, run everything above PLUS additional deep checks:
- Full credential exposure audit (entire workspace)
- Unusual access pattern review
- Injection attempt summary for the month
- Skills supply chain review
- Configuration drift check

---

## Edge Cases

**No sudo access:**
- Most checks work without sudo
- Note "limited visibility — no sudo" for UFW and journalctl

**OpenClaw update available:**
- Note it but never auto-update

**Disk filling fast:**
- If disk jumped >5% in 24h, flag as warning

**npm audit finds vulnerabilities in dev dependencies:**
- Only flag production dependencies (`--production` flag)

**Credential found in a file:**
- Report file path and credential type
- NEVER include the actual credential value
- Recommend: rotate the key, remove from file

**Gateway auth reminder fatigue:**
- Only mention gateway auth in weekly and monthly summaries

---

## Schedule

- **When:** Daily 5:00am local time, Monday-Friday
- **Delivery:** Announce delivery. Reply NO_REPLY for all-clear days (suppresses delivery).
- **Timeout:** 300 seconds
- **Friday:** Extended run includes weekly summary + script audit
- **1st of month:** Extended run includes full monthly deep audit

---

## Dependencies

- `ss`, `df`, `free`, `uptime`, `last`, `systemctl`, `tailscale` — all available without sudo
- `journalctl` for SSH logs — may need sudo for full access
- `apt list --upgradable` — works without sudo
- `openclaw --version` and `npm view` — for version check
- `npm audit` — for dependency vulnerability scanning
- `grep`, `find` — for credential and script scanning
