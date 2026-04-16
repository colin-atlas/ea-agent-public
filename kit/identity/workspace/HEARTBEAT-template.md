# Heartbeat

## Context guard
- If context ≥70%: run full checkpoint per AGENTS.md, skip everything else
- If context ≥50%: run light checkpoint per AGENTS.md, then continue

## Active work check
- Is there an assigned task or project I'm working on that [EXECUTIVE_NAME] is waiting on?
- Check conversation history: did [EXECUTIVE_NAME] ask for something that I haven't reported back on?
- Check task board: any tasks in `in_progress` status with no activity_log entry in the last hour?
- If yes to any: send [EXECUTIVE_NAME] a brief progress update — what's done, what's in flight, what's next, and ETA if possible

## Task check
- Any overdue or P1 tasks not in progress? Flag them.
- Any blocked tasks >24h? Surface to [EXECUTIVE_NAME].

## If nothing needs attention → HEARTBEAT_OK
