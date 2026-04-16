# Debrief Template

Canonical output format for `brain/meetings/debriefs/YYYY-MM-DD-{slug}.md` and the group-DM delivery message.
Use proper markdown with YAML frontmatter, `##` headers, and `-` bullet lists for clean rendering and dashboard parsing.

---

## Canonical file format

Each meeting debrief file should be formatted like this:

```markdown
---
title: {Title}
date: {YYYY-MM-DD}
type: {type}
attendees:
  - {Attendee 1}
  - {Attendee 2}
tags:
  - {tag1}
  - {tag2}
fathom_id: {recording_id}
source: {share_url}
---

## Summary

{2-3 sentence summary of what happened and key outcomes}

## Key Discussion Points

- {point 1}
- {point 2}
- {point 3}

## Decisions Made

- {decision 1}
- {decision 2}

## [EXECUTIVE_FIRST_NAME]'s Action Items

- {item 1} — due {date}
- {item 2} — due {date}

## Commitments from Others

- **{Name}**: {commitment} — due {date}

## Leadership Coaching

{Executive coaching feedback — see notes below}
```

## Group DM delivery format

When posting to the group DM, prepend this header before the markdown body:

```
**Meeting Debrief** — {Title}
{Date} | {Duration} | {Type} | {Tags}
{share_url}
```

Then the full debrief markdown content.

---

## Notes

- Use `##` headers and `- ` bullet lists — never special characters or `**bold**` as headers
- Keep the whole debrief under 60 seconds to read
- Omit any section that has no content (don't show empty sections with "None")
- Duration = `recording_end_time - recording_start_time`, rounded to nearest 5 min
- For 1:1s, the "Commitments from Others" section is especially important

## Leadership Coaching section

Write this as an **executive coach** providing direct, specific feedback to [EXECUTIVE_FIRST_NAME]:
- How did [EXECUTIVE_FIRST_NAME] show up in this meeting? What worked well?
- Was there anything they could have handled better? Be specific — cite a moment from the transcript
- Were there unspoken dynamics? (tension, avoidance, misalignment, someone disengaged)
- One concrete growth area for [EXECUTIVE_FIRST_NAME] as a leader
- Tone: warm but honest, like a trusted coach — not corporate or generic
- Skip entirely for standups and very short syncs (<10 min)

## Tag format examples

- `1on1, jane`
- `team, all-hands`
- `advisory, mentor-name`
- `external, partner-name`
