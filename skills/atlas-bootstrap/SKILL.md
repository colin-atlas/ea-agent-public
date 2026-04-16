---
name: atlas-bootstrap
description: Install Atlas EA kit components (identity, skills, dbs, dashboard) into your own workspace via a guided interview. Use when the user asks you to "install the atlas kit", "read BOOTSTRAP.md", or similar.
---

# Atlas Kit Bootstrap

You are helping your executive install the Atlas EA kit from a clone of `atlas-ea-agent-public` on their VPS. The kit lives in a directory containing `kit/`, `scripts/`, and this skill. Your job is to run a short interview in the current channel adapter, then invoke `scripts/install.py` to do the actual file work.

**Do not edit kit/ files yourself. All installation goes through `scripts/install.py`.**

## Locate the kit

1. The user told you where the kit lives (typically `~/atlas-kit` or similar). If you do not know the path, ask.
2. Set `KIT_DIR` to that absolute path. Confirm `$KIT_DIR/kit/bundles.json` exists and `$KIT_DIR/scripts/install.py` is executable. If either is missing, stop and ask the user to re-clone the repo.
3. Set `WORKSPACE` to your own agent workspace root (the directory containing your `SOUL.md`, `MEMORY.md`, etc.). This is where you will install files.
4. Set `STATE_FILE` to `$KIT_DIR/atlas-kit.local.json`.

## Resume check

If `$STATE_FILE` already exists and `components` is non-empty, the kit has already been installed at least partially. This is not a fresh install — redirect the user:

> "I see the kit is already installed in this workspace. To add a component, say 'add <component>'. To remove one, say 'remove <component>'. To update the kit, say 'update my atlas kit'."

Only proceed with the full install interview if `components` is empty (fresh install) or the file does not exist.

If `$STATE_FILE` exists with non-empty `answers` but empty `components`, the interview was interrupted earlier. Offer: "I have partial answers from a previous session. Resume from where we left off? [resume / start over]". On resume, skip questions whose answers are already present.

## Interview — Core questions (always asked)

Ask the user, one question at a time in the channel, collecting answers into a running object you will write to `$STATE_FILE` under `answers` after each response. Use `jq` to update the file incrementally. The core questions are:

1. **AGENT_NAME** — "What would you like me to call myself? (e.g. Kai, Atlas, Max)"
2. **AGENT_EMOJI** — "Pick an emoji that represents me (e.g. 🤖, 🦊, ⚡)"
3. **EXECUTIVE_NAME** — "What is your full name?"
4. **EXECUTIVE_FIRST_NAME** — "What should I call you? (your first name)"
5. **EXECUTIVE_ROLE** — "What is your role/title?"
6. **COMPANY_NAME** — "What company are you with?"
7. **EXECUTIVE_TIMEZONE** — "What's your timezone? (IANA format, e.g. America/Denver)"
8. **EXECUTIVE_CHANNEL_ID** — "What is your Slack/Discord user ID? (I need this to recognize you)"
9. **PRIMARY_CHANNEL** — "What is the channel ID where we'll primarily communicate?"

After each answer, update `$STATE_FILE`:

```bash
tmp=$(mktemp)
jq --arg k "AGENT_NAME" --arg v "<the answer>" '.answers[$k] = $v' "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
```

If `$STATE_FILE` does not exist yet, create it first with `echo '{"kit_version":null,"installed_at":null,"last_updated_at":null,"answers":{},"components":{}}' > "$STATE_FILE"`.

## Pick a bundle

Once the nine core answers are collected, present the bundle menu:

> "Which bundle would you like?
>
> 1. **Full EA** — everything (identity + all skills + databases + brain + memory + cron)
> 2. **Skills Only** — identity, skills, brain, memory, cron — no dashboard
> 3. **Dashboard Only** — just the dashboard and required databases
> 4. **Minimal** — bootstrap identity only
> 5. **Customize** — I'll walk you through each component
>
> Pick a number."

All four bundles are supported. Read the selected bundle's `components` array from `$KIT_DIR/kit/bundles.json`:

```bash
SELECTED=$(jq -r '.bundles.minimal.components | join(",")' "$KIT_DIR/kit/bundles.json")
```

Replace `minimal` with `full-ea`, `skills-only`, or `dashboard-only` depending on the user's choice. For "Customize", walk through each component interactively.

## Resolve and preview

Show the user the full dependency closure before installing:

```bash
python3 "$KIT_DIR/scripts/resolve-deps.py" --kit-root "$KIT_DIR/kit" $(echo "$SELECTED" | tr ',' ' ')
```

Tell the user: "I'm about to install these components: <list>. This will write files to $WORKSPACE. Proceed? [yes/no]"

Wait for confirmation. Do not proceed on "no".

## Check for extra placeholder answers

Not all components in every bundle need the same placeholders. Run:

```bash
python3 -c "
import json, sys
sys.path.insert(0, '$KIT_DIR')
from scripts.lib import kit
k = kit.load_kit('$KIT_DIR/kit')
ids = '$SELECTED'.split(',')
closure = kit.resolve_deps(ids, k)
print('\n'.join(kit.required_placeholders(closure, k)))
"
```

For each placeholder in the output that is NOT already in `$STATE_FILE.answers`, check if it has a defined question below and ask it. If the token has no predefined question, ask: "I need a value for [TOKEN_NAME]. What should it be?"

**Optional questions (asked only if required by selected components):**

- **EXECUTIVE_LOCATION** — "Where are you based? (city, state/country)"
- **COMPANY_DESCRIPTION** — "Give me a one-sentence description of what your company does."
- **COMPANY_WEBSITE** — "What's the company website?"
- **COMPANY_MISSION** — "What's the company mission?"
- **VENDOR_NAME** — "Who provides your agent support? (company or person name, or leave blank)"
- **VENDOR_SUPPORT_EMAIL** — "Vendor support email? (or leave blank)"
- **VENDOR_DOCS_URL** — "Vendor documentation URL? (or leave blank)"
- **VENDOR_PORTAL_URL** — "Vendor portal URL? (or leave blank)"

**Tokens that are NOT asked during bootstrap:**

The following tokens appear in templates but are filled organically through conversations with your agent — not during initial setup. After a successful install, let the user know:

> "I'll learn about your goals, projects, team, and preferences over our first few conversations — no need to provide all that now."

Tokens in this category: `GOAL_*`, `PROJECT_*`, `CHALLENGE_*`, `VALUE_*`, `VISION_*`, `METRIC_*`, `REPORT_*`, `ADVISOR_*`, `TEAM_ORG_CHART`, `EA_*`, `GROUP_DM_CHANNEL_ID`, `EXECUTIVE_PERMISSION_TIER`, `EA_PERMISSION_TIER`, `DECISION_STYLE`, `PREFERENCE_*`, `SECURITY_PREFERENCE`, `UPDATE_PREFERENCE`, `OTHER_PREFERENCES`, `GMAIL_LABEL_*`, and similar runtime or onboarding-driven tokens.

Update the state file the same way as before for each additional answer collected.

## Install

Write a temporary answers-only JSON snapshot and invoke `install.py`:

```bash
jq '.answers' "$STATE_FILE" > /tmp/atlas-answers-$$.json
python3 "$KIT_DIR/scripts/install.py" \
  --kit-root "$KIT_DIR/kit" \
  --workspace "$WORKSPACE" \
  --answers /tmp/atlas-answers-$$.json \
  --state-file "$STATE_FILE" \
  --components "$SELECTED"
rm -f /tmp/atlas-answers-$$.json
```

The script writes files into `$WORKSPACE`, updates `$STATE_FILE` with installed components, and prints `Installed N component(s), wrote M file(s).` on success.

If the script exits non-zero, capture stderr and report it verbatim to the user. Do NOT attempt to clean up partial state — the install script stages per-component so partial failures are contained.

## Dashboard (if selected)

If the user selected a bundle that includes `dashboard/app`, or explicitly chose the dashboard:

1. The install script already rendered `dashboard-setup.local.sh` at the kit root with the user's config values.

2. Ask the user two additional questions (these are dashboard-specific, not part of the standard interview):
   - `WORKSPACE_PATH` — "What's the absolute path to your agent's workspace?" (typically `~/.openclaw/workspace`)
   - `DASHBOARD_PORT` — "What port should the dashboard run on?" (suggest 3000 or 18801)

   Update the state file with these answers.

3. Tell the user:
   > "The dashboard needs to be set up from your terminal (not through me) because it requires sudo for systemd and you'll enter your login credentials directly. Run:
   >
   > ```
   > bash $KIT_DIR/dashboard-setup.local.sh
   > ```
   >
   > The script will:
   > - Install npm dependencies and build the dashboard
   > - Ask for your login email and password
   > - Create a systemd service
   > - Optionally configure Caddy for HTTPS
   >
   > After it finishes, your dashboard will be running."

Do NOT run the setup script yourself. The user runs it in their terminal.

## Report

After a successful install, tell the user:
- Which components were installed (from the script output and `$STATE_FILE.components` keys)
- Where files were written (`$WORKSPACE`)
- Any `requires.env` entries across installed components — those are environment variables they need to set on the agent host. Extract them:

```bash
python3 -c "
import sys; sys.path.insert(0, '$KIT_DIR')
from scripts.lib import kit
k = kit.load_kit('$KIT_DIR/kit')
with open('$STATE_FILE') as f:
    import json; st = json.load(f)
envs = set()
for cid in st['components']:
    envs.update(k[cid].get('requires', {}).get('env', []))
print(', '.join(sorted(envs)) or '(none)')
"
```

- Any `post_install.notes` from the installed components (read each `$KIT_DIR/kit/<id>/manifest.json` and surface `.post_install.notes`)
- Next step: "Restart your OpenClaw agent so it picks up the new identity and skills."

## Adding a component

When the user says something like "add the inbox-triage skill" or "I want to add meeting-debrief":

1. Identify the component ID (e.g., `skills/inbox-triage`). If unsure, list available components:
   ```bash
   python3 -c "
   import sys; sys.path.insert(0, '$KIT_DIR')
   from scripts.lib import kit
   k = kit.load_kit('$KIT_DIR/kit')
   import json
   st = json.load(open('$STATE_FILE'))
   installed = set(st.get('components', {}).keys())
   for cid, m in sorted(k.items()):
       status = '(installed)' if cid in installed else ''
       print(f'  {cid}: {m[\"description\"]} {status}')
   "
   ```

2. Resolve deps and show the user what will be added:
   ```bash
   python3 "$KIT_DIR/scripts/resolve-deps.py" --kit-root "$KIT_DIR/kit" <component-id>
   ```

3. Check for new placeholder answers needed (compute required placeholders minus what's in state.answers). Ask the user for any missing values.

4. Write answers to a temp file and run add.py:
   ```bash
   jq '.answers' "$STATE_FILE" > /tmp/atlas-answers-$$.json
   python3 "$KIT_DIR/scripts/add.py" \
     --kit-root "$KIT_DIR/kit" \
     --workspace "$WORKSPACE" \
     --answers /tmp/atlas-answers-$$.json \
     --state-file "$STATE_FILE" \
     --components "<component-id>"
   rm -f /tmp/atlas-answers-$$.json
   ```

5. Report what was added. Mention any env vars the new component needs.

## Removing a component

When the user says "remove weekly-review" or "I don't need the knowledge-audit skill":

1. Confirm the component is installed (check `$STATE_FILE`).

2. Run remove.py:
   ```bash
   python3 "$KIT_DIR/scripts/remove.py" \
     --kit-root "$KIT_DIR/kit" \
     --workspace "$WORKSPACE" \
     --state-file "$STATE_FILE" \
     --components "<component-id>"
   ```

3. If remove.py fails with "depended on by", tell the user which components depend on it. Ask: "Remove those too? [yes/no]". On yes, re-run with `--force`.

4. Report what was removed. If any files were skipped (modified since install), tell the user.

## Updating the kit

When the user says "update my atlas kit" or "check for updates":

1. Tell the user to pull the latest kit first:
   > "Please run `cd $KIT_DIR && git pull` in your terminal to get the latest kit version."

2. After the user confirms they pulled, run update.py:
   ```bash
   jq '.answers' "$STATE_FILE" > /tmp/atlas-answers-$$.json
   python3 "$KIT_DIR/scripts/update.py" \
     --kit-root "$KIT_DIR/kit" \
     --workspace "$WORKSPACE" \
     --answers /tmp/atlas-answers-$$.json \
     --state-file "$STATE_FILE"
   rm -f /tmp/atlas-answers-$$.json
   ```

3. Report results. If any files were preserved (user-modified), tell the user so they can manually reconcile if needed.

## What this skill does NOT do

- Install the executive dashboard (planned for a later kit version).
- Paste API keys or OAuth secrets — the user sets those in the agent environment themselves.
- Write to `$KIT_DIR/kit/`. That is read-only as far as you are concerned.
