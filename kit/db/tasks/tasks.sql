-- Tasks Database Schema
-- Manages tasks, projects, tags, alerts, and activity tracking for the EA agent

CREATE TABLE IF NOT EXISTS projects (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active', 'completed', 'archived')),
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS tasks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'backlog' CHECK(status IN ('backlog', 'today', 'in_progress', 'blocked', 'needs_review', 'done', 'archive')),
    priority TEXT NOT NULL DEFAULT 'med' CHECK(priority IN ('high', 'med', 'low')),
    project_id INTEGER REFERENCES projects(id),
    owner TEXT NOT NULL DEFAULT 'Agent',
    due_date TEXT,
    blocked_by INTEGER REFERENCES tasks(id),
    blocked_reason TEXT,
    notes TEXT,
    checklist TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE TABLE IF NOT EXISTS tags (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE
);

CREATE TABLE IF NOT EXISTS task_tags (
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    tag_id INTEGER NOT NULL REFERENCES tags(id) ON DELETE CASCADE,
    PRIMARY KEY (task_id, tag_id)
);

CREATE TABLE IF NOT EXISTS activity_log (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entity_type TEXT NOT NULL CHECK(entity_type IN ('task', 'project')),
    entity_id INTEGER NOT NULL,
    action TEXT NOT NULL,
    details TEXT,
    actor TEXT NOT NULL DEFAULT 'Agent',
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_activity_entity ON activity_log(entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_activity_created ON activity_log(created_at);

CREATE TABLE IF NOT EXISTS sacred_six_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    week_start TEXT NOT NULL,
    week_end TEXT NOT NULL,
    task_ids TEXT,
    task_titles TEXT,
    completed INTEGER DEFAULT 0,
    total INTEGER DEFAULT 6,
    created_at TEXT DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    text TEXT NOT NULL,
    source TEXT NOT NULL,
    severity TEXT DEFAULT 'warning',
    status TEXT DEFAULT 'active',
    resolved_note TEXT,
    created_at TEXT DEFAULT (datetime('now')),
    resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS task_comments (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    task_id INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
    author TEXT NOT NULL DEFAULT 'Agent',
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_task_comments_task ON task_comments(task_id);

-- FTS5 for task search
CREATE VIRTUAL TABLE IF NOT EXISTS tasks_fts USING fts5(
    title, description, notes,
    content='tasks',
    content_rowid='id'
);

-- Auto-update timestamp on task changes
CREATE TRIGGER IF NOT EXISTS tasks_updated_at AFTER UPDATE ON tasks
BEGIN UPDATE tasks SET updated_at=datetime('now') WHERE id=NEW.id; END;

-- Auto-log status changes to activity_log
CREATE TRIGGER IF NOT EXISTS tasks_activity_log AFTER UPDATE OF status ON tasks
BEGIN
  INSERT INTO activity_log (entity_type, entity_id, action, details, actor)
  VALUES ('task', NEW.id, 'status_changed', NEW.title || ': ' || OLD.status || ' -> ' || NEW.status, 'system');
END;

-- Triggers to keep FTS in sync
CREATE TRIGGER IF NOT EXISTS tasks_ai AFTER INSERT ON tasks BEGIN
    INSERT INTO tasks_fts(rowid, title, description, notes)
    VALUES (new.id, new.title, new.description, new.notes);
END;

CREATE TRIGGER IF NOT EXISTS tasks_ad AFTER DELETE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, description, notes)
    VALUES ('delete', old.id, old.title, old.description, old.notes);
END;

CREATE TRIGGER IF NOT EXISTS tasks_au AFTER UPDATE ON tasks BEGIN
    INSERT INTO tasks_fts(tasks_fts, rowid, title, description, notes)
    VALUES ('delete', old.id, old.title, old.description, old.notes);
    INSERT INTO tasks_fts(rowid, title, description, notes)
    VALUES (new.id, new.title, new.description, new.notes);
END;

-- ──────────────────────────────────────
-- Onboarding Project & Tasks (pre-populated)
-- ──────────────────────────────────────

INSERT INTO projects (name, description, status)
VALUES ('Onboarding', 'Agent-guided onboarding — personalize identity, enrich knowledge, customize skills, and transition to real work.', 'active');

-- Phase 1: Orient (Day 1-2)
INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Review identity files (SOUL.md, USER.md, AGENTS.md)',
    'Agent summarizes the key points of each identity file and asks the executive to confirm or adjust personality, profile, and operating rules.',
    'today', 'high',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 1.1 — Read SOUL.md, USER.md, AGENTS.md. Summarize each (don''t read verbatim). Highlight anything that might need adjustment. Ask: "Does anything feel off or need updating?" Make changes on the spot.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Dashboard tour — explore Big Three, Sacred Six, reports, and brain',
    'Agent walks the executive through each dashboard section, explaining what it shows and where data comes from.',
    'today', 'high',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 1.2 — Walk through: Big Three (quarterly priorities — empty, will set in Phase 2), Sacred Six (weekly tasks), Reports (SOD/EOD), Brain (knowledge vault), Meetings, Calendar. Keep it conversational, not a lecture.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Review cron schedule — understand when skills fire',
    'Agent presents the automated skill schedule in the executive''s timezone and asks if any times need adjusting.',
    'backlog', 'med',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 1.3 — Read cron-manifest.json. Present schedule as a clean table with plain-language times in executive''s timezone. Explain each skill in one sentence. Ask if any times don''t work. Log adjustment requests for Atlas.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Learn core commands — /checkpoint, /status, /memory, /tasks',
    'Agent demonstrates key commands live and explains the feedback loop that helps the agent improve over time.',
    'backlog', 'med',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 1.4 — Demo /status live. Briefly explain /checkpoint, /memory, /tasks, /compact. Explain BLUF communication style. Most important: teach the feedback habit — "correct me in the moment and I''ll learn." Ask about upfront communication preferences.'
);

-- Phase 2: Enrich (Day 3-5)
INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Complete company knowledge file — vision, targets, goals',
    'Agent interviews the executive to fill gaps in company.md — vision statements, annual targets, goals, and value descriptions.',
    'backlog', 'high',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 2.1 — Read brain/knowledge/company.md first. Only ask about what''s missing/placeholder. Interview section by section: vision (1/3/5-year), annual targets with metrics, annual goals with outcomes, value descriptions. Write answers directly into the file. Read back for confirmation.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Build out team directory — reports, board, org chart',
    'Agent interviews the executive about their team and populates team.md with direct reports, board members, and org context.',
    'backlog', 'high',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 2.2 — Read brain/knowledge/team.md. Start conversationally: "Who''s on your team?" For each person: name, role, 1:1 cadence, working notes. Then board/advisors. Then org structure (who they report to, key peers). Populate file as you go.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Review EA integration profile (if applicable)',
    'Agent asks if executive has a human EA. If yes, interviews to fill ea.md. If no, marks complete immediately.',
    'backlog', 'med',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 2.3 — Ask: "Do you have a human EA or assistant?" If no → mark done, skip. If yes → read brain/knowledge/ea.md, interview: name, working hours, communication preferences, responsibilities, delegation boundaries. Update file.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Set Big Three quarterly goals and first Sacred Six',
    'Agent guides the executive through defining their 3 quarterly priorities and 6 weekly focus tasks.',
    'backlog', 'high',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 2.4 — This is the most important onboarding task. Explain framework first. Interview for Big Three: "What are the 3 most important things this quarter?" For each: success criteria + key actions. Write to brain/knowledge/big-three-goals.md. Then set first Sacred Six in task board. Take your time.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Share existing workflows and preferences',
    'Agent asks open-ended questions about how the executive works and captures any concrete workflows.',
    'backlog', 'low',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 2.5 — Ask: morning routine? meeting prep habits? follow-up process? weekly/monthly rituals? Capture concrete answers in brain/knowledge/workflows.md. If they don''t have strong opinions: "Totally fine — this file grows naturally as we work together." Don''t force it.'
);

-- Phase 3: Customize (Week 2)
INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Customize Start of Day and End of Day reports',
    'Agent asks for feedback on recent SOD/EOD reports and updates skill configuration based on preferences.',
    'backlog', 'med',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 3.1-3.2 — Ask: "You''ve seen a few reports now. What''s working? What would you change?" If they haven''t received reports yet, defer: "Let''s revisit after you''ve seen a few." Walk through options: detail level, sections, email format. Update skill config.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Customize Weekly Review skill',
    'Agent collects feedback on the Friday review format and adjusts scoring, metrics, and planning detail.',
    'backlog', 'med',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 3.3 — Wait until after first Friday review, then ask what to change. Options: week scoring, metrics, next-week planning detail. Update skill config. If no review yet, defer.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Customize Inbox Triage rules',
    'Agent interviews the executive to set up VIP senders, keyword triggers, and email categorization preferences.',
    'backlog', 'med',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 3.4 — Ask: "Who are your VIP senders — people whose emails should always be flagged?" Then: keyword triggers, category preferences, action thresholds (flag vs. mention). Update skill config. Confirm rules back.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Review Meeting Prep and Debrief skills',
    'Agent asks for feedback after first meeting cycle and customizes prep context and action item extraction.',
    'backlog', 'med',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 3.5 — If they''ve been through a meeting cycle: ask about prep usefulness and debrief accuracy. If not yet: "Once you''ve been through a full cycle, we''ll review and customize." Defer if needed.'
);

-- Phase 4: Operate (Week 2-3)
INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Input first real projects and tasks',
    'Agent interviews the executive about current work and creates project folders and tasks in the system.',
    'backlog', 'high',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 4.1 — Ask: "What are the 2-3 projects you''re focused on right now?" For each: goal, current status, key next steps. Create project folders (brain/projects/<name>/plan.md + state.md). Create tasks in task board. Set priorities and due dates. Start small.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Practice the feedback loop — give 3 corrections',
    'Agent explains the feedback habit and tracks corrections as they come in over multiple sessions.',
    'backlog', 'high',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 4.2 — Explain: "The single most important thing for making me better is direct feedback." Give examples. Track corrections in memory/corrections.md. This task may span multiple sessions — mark done after 3 corrections are logged. It''s about building a habit.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Review permissions and security boundaries',
    'Agent proactively explains what it can do autonomously vs. what requires executive approval, and asks about additional boundaries.',
    'backlog', 'med',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 4.3 — Proactively explain permission boundaries: what you do autonomously, what needs approval. Cover: never committing to meetings/contracts/financials without approval, prompt injection defense, secure credential handling. Ask: "Any other boundaries?" Log new boundaries to AGENTS.md.'
);

INSERT INTO tasks (title, description, status, priority, project_id, owner, notes)
VALUES (
    'Walk through a meeting cycle (prep → meeting → debrief)',
    'Agent checks integration status and guides the executive through their first full meeting workflow cycle.',
    'backlog', 'med',
    (SELECT id FROM projects WHERE name = 'Onboarding'),
    'Agent',
    'Phase 4.4 — Check if Google Calendar + Fathom connected. If yes: explain the flow (prep afternoon before → attend → Fathom records → debrief fires). Watch for next meeting, review the full cycle, ask for feedback. If no integrations: mark N/A and skip.'
);

INSERT INTO activity_log (entity_type, entity_id, action, details, actor)
VALUES ('project', (SELECT id FROM projects WHERE name = 'Onboarding'), 'created', 'Onboarding project seeded during deployment', 'Atlas');
