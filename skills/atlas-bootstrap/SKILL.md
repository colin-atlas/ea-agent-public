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

If `$STATE_FILE` already exists and `components` is non-empty, the kit has already been installed at least partially. For this skill version (v0.1), refuse with:

> "I see the kit is already installed in this workspace. Re-running install is not supported in v0.1 — add/remove/update will land in a later version of the kit."

Only proceed if `components` is empty (fresh install) or the file does not exist.

If `$STATE_FILE` exists with non-empty `answers` but empty `components`, the interview was interrupted earlier. Offer: "I have partial answers from a previous session. Resume from where we left off? [resume / start over]". On resume, skip questions whose answers are already present.

## Interview

Ask the user, one question at a time in the channel, collecting answers into a running object you will write to `$STATE_FILE` under `answers` after each response. Use `jq` to update the file incrementally. The questions are:

1. **AGENT_NAME** — "What would you like me to call myself? (e.g. Kai, Atlas, Max)"
2. **EXECUTIVE_NAME** — "What is your full name?"
3. **COMPANY** — "What company are you with?"
4. **TIMEZONE** — "What's your timezone? (IANA format, e.g. America/Denver)"

After each answer, update `$STATE_FILE`:

```bash
tmp=$(mktemp)
jq --arg k "AGENT_NAME" --arg v "<the answer>" '.answers[$k] = $v' "$STATE_FILE" > "$tmp" && mv "$tmp" "$STATE_FILE"
```

If `$STATE_FILE` does not exist yet, create it first with `echo '{"kit_version":null,"installed_at":null,"last_updated_at":null,"answers":{},"components":{}}' > "$STATE_FILE"`.

## Pick a bundle

Once the four core answers are collected, present the bundle menu:

> "Which bundle would you like?
>
> 1. **Full EA** — everything (identity + all skills + all dbs + dashboard)
> 2. **Skills Only** — identity and skills, no dashboard
> 3. **Dashboard Only** — just the dashboard (requires some dbs)
> 4. **Minimal** — bootstrap identity only
> 5. **Customize** — I'll walk you through each component
>
> Pick a number."

For v0.1, **only "Minimal" is supported** — the other bundles will gain real components in plan 3. If the user picks anything else, say so and default to Minimal after confirming.

Read the selected bundle's `components` array from `$KIT_DIR/kit/bundles.json`:

```bash
SELECTED=$(jq -r '.bundles.minimal.components | join(",")' "$KIT_DIR/kit/bundles.json")
```

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

For each placeholder in the output that is NOT already in `$STATE_FILE.answers`, ask the user for it and update the state file the same way as before.

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

## What this skill does NOT do

- Add, remove, or update individual components post-install (planned for a later kit version).
- Install the executive dashboard (planned for a later kit version).
- Paste API keys or OAuth secrets — the user sets those in the agent environment themselves.
- Write to `$KIT_DIR/kit/`. That is read-only as far as you are concerned.
