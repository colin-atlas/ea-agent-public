# Atlas Kit Bootstrap

You (the reading agent) are being asked to install the Atlas EA kit into your own workspace from the repo checkout that contains this file.

## Steps

1. Determine `KIT_DIR` — the absolute path of the directory containing THIS file. Usually `~/atlas-kit` on the user's VPS. You can compute it with `KIT_DIR="$(cd "$(dirname "$0")" && pwd)"` if you were invoked as a script, or just ask the user to tell you where they cloned the repo.

2. Copy the `atlas-bootstrap` skill into your own workspace so your skill runtime picks it up:

   ```bash
   mkdir -p "$WORKSPACE/skills/atlas-bootstrap"
   cp "$KIT_DIR/skills/atlas-bootstrap/SKILL.md" "$WORKSPACE/skills/atlas-bootstrap/SKILL.md"
   ```

   Where `$WORKSPACE` is your own workspace root (the directory containing your `SOUL.md` and `skills/` subdirectory).

3. Invoke the `atlas-bootstrap` skill per your skill runtime's invocation protocol. The skill will run an interview with the user and install the selected components.

4. Once the skill completes, tell the user to restart you (the agent) so the freshly-installed identity and skills take effect.

## What this kit provides (v0.1)

- A minimal identity template (`SOUL.md`) that personalizes a handful of `[PLACEHOLDER]` tokens for the user.

Later versions will add skills, databases, scripts, and an executive dashboard.

## Where to read more

- `README.md` — project overview
- `skills/atlas-bootstrap/SKILL.md` — the skill you are about to invoke
- `kit/` — the content library
