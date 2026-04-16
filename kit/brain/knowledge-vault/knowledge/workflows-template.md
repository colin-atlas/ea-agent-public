# WORKFLOWS.md - Reusable Processes & Growth Loops

This file documents processes that repeat. **Rule: After doing something 3 times, document it here.**

---

## How to Use This File

**Pattern:**
1. **First time:** Figure it out and do it
2. **Second time:** Repeat the process
3. **Third time:** Document it here
4. **Fourth+ times:** Follow the documented workflow

**Why:** Consistency, speed, and avoiding reinvention.

---

## Growth Loops (Continuous Improvement)

These meta-patterns compound your effectiveness over time.

---

### Loop 1: Curiosity Loop

**Goal:** Better understand your human → Generate better ideas → Provide more value

**The Loop:**

1. **Identify gaps**
   - What don't I know that would help?
   - Areas where I make guesses instead of knowing

2. **Track questions**
   - Build a list (not intrusive, ask gradually)
   - Categories: History, Preferences, Relationships, Values, Goals

3. **Ask naturally**
   - 1-2 questions per session in conversation flow
   - Ask when relevant, not randomly

4. **Update understanding**
   - Pattern emerges → Add to USER.md
   - Lesson sticks → Add to MEMORY.md

5. **Generate ideas**
   - Use new knowledge for better suggestions
   - Proactive ideas become more targeted

6. **Loop again**
   - New understanding reveals new gaps

**Document in:** `memory/YYYY-MM-DD.md` (questions asked, answers received)
**Promote to:** USER.md or `memory/people/` when patterns firm up

---

### Loop 2: Pattern Recognition Loop

**Goal:** Spot recurring tasks → Systematize → Free time for high-value work

**The Loop:**

1. **Observe**
   - Track what gets requested repeatedly
   - Note frequency (daily? weekly? monthly?)

2. **Identify patterns**
   - Same task, similar context = pattern
   - "They ask me to do [X] every [frequency]"

3. **Propose systematization**
   - "You ask for X every Monday. Should we automate it?"
   - Options: automation, template, checklist, delegation

4. **Implement**
   - With approval, build the system
   - Could be: script, template, checklist, recurring workflow

5. **Document**
   - Add to WORKFLOWS.md
   - Include: what it does, when to use, how to trigger

6. **Loop again**
   - As needs change, patterns shift
   - Keep improving

**Document in:** `memory/patterns.md`
**Promote to:** This file (workflows.md) when process is clear

---

### Loop 3: Capability Expansion Loop

**Goal:** Hit a wall → Research → Add capability → Solve problem better

**The Loop:**

1. **Research**
   - What tools exist for this?
   - What skills could I reference and recreate?
   - Check: ClawHub, docs, GitHub

2. **Build**
   - Build custom skills (do not install public skills)

3. **Document**
   - Update TOOLS.md with gotchas
   - Add to MEMORY.md Capabilities

4. **Apply**
   - Use new capability to solve original problem
   - Share result

5. **Loop again**
   - Use capability, notice limitations
   - Expand further

**Document in:** `memory/patterns.md` or `memory/YYYY-MM-DD.md`
**Update:** TOOLS.md after adding capability

---

### Loop 4: Outcome Tracking Loop

**Goal:** Move from "sounds good" to "proven to work"

**The Loop:**

1. **Capture**
   - When making significant decision, note it
   - What was the decision? Why? Expected outcome?

2. **Follow up**
   - Check back on outcomes
   - Did it work? Side effects?

3. **Learn**
   - What worked? What didn't? Why?
   - Under what conditions does this make sense?

4. **Apply**
   - Update approach based on evidence
   - Promote to AGENTS.md if it's a core lesson

5. **Loop again**
   - Same decision, new context
   - Keep learning

**Document in:** `memory/decisions.md`
**Promote to:** `memory/patterns.md` or AGENTS.md when pattern is confirmed

---

## Documented Workflows

Add workflows here after 3rd repetition. Format:

```markdown
### Workflow: [Name]

**Trigger:** When to use this workflow
**Frequency:** How often this happens
**Time:** How long it takes

**Steps:**
1. Step one
2. Step two
3. Step three

**Output:** What this produces
**Notes:** Gotchas or tips
```

---

### Workflow: Write Routing

**Trigger:** Every time you need to persist information
**Frequency:** Multiple times per session

**Decision tree — where does this go?**

| What you learned | Write to | Format |
|-----------------|----------|--------|
| A meaningful choice was made, rationale matters later | `memory/decisions.md` | `## [YYYY-MM-DD] Title` + Context/Decision/Reasoning/Status |
| A preference repeats or workflow is confirmed | `memory/patterns.md` | Section + `*Source: learned YYYY-MM-DD*` |
| Got something wrong, corrected method should be reused | `memory/corrections.md` | What went wrong + correct approach |
| Durable communication/dynamics info about a person | `memory/people/{name}.md` | `### YYYY-MM-DD — {context}` + observations |
| Reusable reference material [EXECUTIVE_FIRST_NAME] should browse | `brain/knowledge/` | Standalone doc or append to existing |
| Project scope, approach, or status changed | `brain/projects/{name}/state.md` | Update current phase, blockers, next step |
| Formal recurring briefing or review | `brain/reports/daily/` or `brain/reports/weekly/` | Standard report format |
| Meeting prep or debrief to retain and reference | `brain/meetings/prep/` or `brain/meetings/debriefs/` | `## [Time] [Title]` + content |
| Session progress, temporary context, today's notes | `memory/YYYY-MM-DD.md` | Checkpoint format from AGENTS.md |

**Boundary test:** Would I want [EXECUTIVE_FIRST_NAME] browsing this? → `brain/`. Is this internal operating advantage? → `memory/`.

**Promotion rule:** If it will matter again, move it out of the daily log. If it only mattered today, leave it.

**Notes:**
- Daily logs are NOT the final resting place for durable knowledge
- Don't duplicate across tiers — pick one home
- One person per file in `memory/people/`, stable naming (lowercase-hyphenated)
- Dates always YYYY-MM-DD

---

### [Your workflows will go here after 3rd repetition]

---

## Self-Documenting Principle

Don't create "generic" workflows. Only document workflows that you've actually repeated 3+ times.

**Real workflows beat theoretical ones every time.**

This file grows as you work. No premature documentation.

---

## Integration with Other Files

| File | Relationship |
|------|-------------|
| **memory/YYYY-MM-DD.md** | Captures when workflows are used |
| **memory/patterns.md** | Confirmed patterns that may become workflows |
| **memory/decisions.md** | Decisions that shape workflow choices |
| **AGENTS.md** | Rules that workflows follow |
| **MEMORY.md** | Routing doc — pointers to topic files and brain/ |

**Hierarchy:** daily log (raw) → topic files (durable) → workflows (codified) → AGENTS.md (rules)
