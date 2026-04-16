# atlas-ea-agent-public

DIY kit for adding Atlas EA capabilities (identity, skills, databases, executive dashboard) to an OpenClaw agent you deployed yourself via [openclaw-setup](https://github.com/colin-atlas/openclaw-setup).

> **Status:** Under construction. This repo is currently being populated. See `docs/superpowers/specs/2026-04-15-atlas-ea-agent-public-design.md` in the private planning workspace for the design.

## What this is

A library of components — identity files, skills, database schemas, scripts, and an executive dashboard — that your OpenClaw agent can install into its own workspace via a guided interview. Cafeteria-style: take the whole package or cherry-pick what you want.

## How it works (once plans 2+ land)

1. SSH to your VPS.
2. `git clone https://github.com/colin-atlas/atlas-ea-agent-public ~/atlas-kit`
3. Message your agent: *"Read `~/atlas-kit/BOOTSTRAP.md` and follow it."*
4. Your agent interviews you in Slack/Discord, then installs the components you pick.

## License

MIT — see [LICENSE](LICENSE).
