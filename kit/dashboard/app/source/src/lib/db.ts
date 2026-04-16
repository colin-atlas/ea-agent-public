import Database from "better-sqlite3";
import path from "path";

const WORKSPACE = process.env.WORKSPACE_PATH || process.env.HOME + "/.openclaw/workspace";
const DB_PATH = path.join(WORKSPACE, "db", "tasks.db");

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export function getWorkspacePath(): string {
  return WORKSPACE;
}

export interface Project {
  id: number;
  name: string;
  description: string | null;
  status: string;
  created_at: string;
  updated_at: string;
}

export interface Task {
  id: number;
  title: string;
  description: string | null;
  project_id: number | null;
  priority: string;
  status: string;
  owner: string;
  due_date: string | null;
  blocked_by: number | null;
  blocked_reason: string | null;
  notes: string | null;
  checklist: string | null;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  project_name?: string;
  tags?: string;
}

export interface TaskComment {
  id: number;
  task_id: number;
  author: string;
  content: string;
  created_at: string;
}

export interface ActivityEntry {
  id: number;
  entity_type: string;
  entity_id: number;
  action: string;
  details: string | null;
  actor: string;
  created_at: string;
}
