#!/usr/bin/env bash
# tasks.sh — Task management CLI for EA Agent (SQLite version)
# Usage: tasks.sh <command> [options]

set -euo pipefail

# Database path — resolve relative to workspace
WORKSPACE="${OPENCLAW_WORKSPACE:-$HOME/.openclaw/workspace}"
DB="${TASKS_DB:-$WORKSPACE/db/tasks.db}"

# Initialize DB if needed
init_db() {
    if [ ! -f "$DB" ] || [ ! -s "$DB" ]; then
        local schema_dir="$(dirname "$0")/../schemas"
        if [ -f "$schema_dir/tasks.sql" ]; then
            sqlite3 "$DB" < "$schema_dir/tasks.sql"
            echo "✓ Tasks database initialized at $DB"
        else
            echo "ERROR: Schema file not found at $schema_dir/tasks.sql" >&2
            exit 1
        fi
    fi
}

# Commands
cmd_add() {
    local title="${1:?Usage: tasks.sh add <title> [--priority high] [--status backlog] [--project <id>] [--tags <tags>] [--notes <notes>]}"
    shift
    local priority="medium" status="backlog" project="" tags="" notes="" due=""
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --priority) priority="$2"; shift 2 ;;
            --status) status="$2"; shift 2 ;;
            --project) project="$2"; shift 2 ;;
            --tags) tags="$2"; shift 2 ;;
            --notes) notes="$2"; shift 2 ;;
            --due) due="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    local id=$(sqlite3 "$DB" "INSERT INTO tasks (title, priority, status, project_id, tags, notes, due_date) VALUES ('$(echo "$title" | sed "s/'/''/g")', '$priority', '$status', $([ -n "$project" ] && echo "$project" || echo "NULL"), $([ -n "$tags" ] && echo "'$tags'" || echo "NULL"), $([ -n "$notes" ] && echo "'$(echo "$notes" | sed "s/'/''/g")'" || echo "NULL"), $([ -n "$due" ] && echo "'$due'" || echo "NULL")) RETURNING id;")
    
    sqlite3 "$DB" "INSERT INTO activity_log (task_id, action, new_value, source) VALUES ($id, 'created', '$status', 'cli');"
    echo "✓ Task #$id created: $title [$priority/$status]"
}

cmd_list() {
    local status_filter="" priority_filter="" limit="50"
    
    while [[ $# -gt 0 ]]; do
        case "$1" in
            --status) status_filter="$2"; shift 2 ;;
            --priority) priority_filter="$2"; shift 2 ;;
            --limit) limit="$2"; shift 2 ;;
            *) shift ;;
        esac
    done

    local where="WHERE 1=1"
    [ -n "$status_filter" ] && where="$where AND status IN ($(echo "$status_filter" | sed "s/[^,]*/'\0'/g"))"
    [ -n "$priority_filter" ] && where="$where AND priority = '$priority_filter'"

    sqlite3 -header -column "$DB" "SELECT id, title, status, priority, tags, date(updated_at) as updated FROM tasks $where AND status != 'archive' ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END, updated_at DESC LIMIT $limit;"
}

cmd_update() {
    local id="${1:?Usage: tasks.sh update <id> [--status <status>] [--priority <priority>] [--notes <notes>] [--tags <tags>]}"
    shift

    while [[ $# -gt 0 ]]; do
        case "$1" in
            --status)
                local old=$(sqlite3 "$DB" "SELECT status FROM tasks WHERE id=$id;")
                sqlite3 "$DB" "UPDATE tasks SET status='$2', updated_at=datetime('now') $([ "$2" = "done" ] && echo ", completed_at=datetime('now')") WHERE id=$id;"
                sqlite3 "$DB" "INSERT INTO activity_log (task_id, action, old_value, new_value, source) VALUES ($id, 'status_change', '$old', '$2', 'cli');"
                echo "✓ Task #$id: $old → $2"
                shift 2 ;;
            --priority)
                sqlite3 "$DB" "UPDATE tasks SET priority='$2', updated_at=datetime('now') WHERE id=$id;"
                echo "✓ Task #$id priority → $2"
                shift 2 ;;
            --notes)
                sqlite3 "$DB" "UPDATE tasks SET notes='$(echo "$2" | sed "s/'/''/g")', updated_at=datetime('now') WHERE id=$id;"
                echo "✓ Task #$id notes updated"
                shift 2 ;;
            --tags)
                sqlite3 "$DB" "UPDATE tasks SET tags='$2', updated_at=datetime('now') WHERE id=$id;"
                echo "✓ Task #$id tags → $2"
                shift 2 ;;
            *) shift ;;
        esac
    done
}

cmd_search() {
    local query="${1:?Usage: tasks.sh search <query>}"
    sqlite3 -header -column "$DB" "SELECT t.id, t.title, t.status, t.priority FROM tasks t JOIN tasks_fts f ON t.id = f.rowid WHERE tasks_fts MATCH '$(echo "$query" | sed "s/'/''/g")' AND t.status != 'archive' ORDER BY rank LIMIT 20;"
}

cmd_show() {
    local id="${1:?Usage: tasks.sh show <id>}"
    sqlite3 -header -column "$DB" "SELECT * FROM tasks WHERE id=$id;"
    echo ""
    echo "--- Activity Log ---"
    sqlite3 -header -column "$DB" "SELECT action, old_value, new_value, source, created_at FROM activity_log WHERE task_id=$id ORDER BY created_at;"
}

cmd_sacred_six() {
    local week="${1:-$(date +%Y-W%V)}"
    sqlite3 -header -column "$DB" "SELECT id, title, status, priority FROM tasks WHERE tags LIKE '%sacred-six%' AND status NOT IN ('archive') ORDER BY CASE priority WHEN 'critical' THEN 1 WHEN 'high' THEN 2 WHEN 'medium' THEN 3 WHEN 'low' THEN 4 END;"
}

# Main
init_db

case "${1:-help}" in
    add) shift; cmd_add "$@" ;;
    list) shift; cmd_list "$@" ;;
    update) shift; cmd_update "$@" ;;
    search) shift; cmd_search "$@" ;;
    show) shift; cmd_show "$@" ;;
    sacred-six) shift; cmd_sacred_six "$@" ;;
    help|*)
        echo "tasks.sh — Task management CLI"
        echo ""
        echo "Commands:"
        echo "  add <title> [--priority high] [--status backlog] [--tags <tags>]"
        echo "  list [--status today,in_progress] [--priority high]"
        echo "  update <id> [--status done] [--priority high] [--notes <text>]"
        echo "  search <query>"
        echo "  show <id>"
        echo "  sacred-six [week]"
        ;;
esac
