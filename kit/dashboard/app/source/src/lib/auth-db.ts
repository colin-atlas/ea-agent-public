import Database from "better-sqlite3";
import path from "path";

const WORKSPACE = process.env.WORKSPACE_PATH || process.env.HOME + "/.openclaw/workspace";
const DB_PATH = path.join(WORKSPACE, "db", "auth.db");

let db: Database.Database | null = null;

function getAuthDb(): Database.Database {
  if (!db) {
    db = new Database(DB_PATH);
    db.pragma("journal_mode = WAL");
    db.pragma("foreign_keys = ON");
  }
  return db;
}

export interface User {
  id: number;
  email: string;
  password_hash: string;
  full_name: string | null;
  role: string;
}

export interface SessionWithUser {
  id: number;
  user_id: number;
  token: string;
  expires_at: string;
  email: string;
  full_name: string | null;
  role: string;
}

export function getUserByEmail(email: string): User | null {
  const db = getAuthDb();
  return db.prepare("SELECT * FROM users WHERE email = ?").get(email) as User | null;
}

export function getSessionByToken(token: string): SessionWithUser | null {
  const db = getAuthDb();
  return db.prepare(`
    SELECT s.id, s.user_id, s.token, s.expires_at, u.email, u.full_name, u.role
    FROM sessions s
    JOIN users u ON u.id = s.user_id
    WHERE s.token = ?
  `).get(token) as SessionWithUser | null;
}

export function createSession(userId: number, token: string, expiresAt: string): void {
  const db = getAuthDb();
  db.prepare("INSERT INTO sessions (user_id, token, expires_at) VALUES (?, ?, ?)").run(userId, token, expiresAt);
}

export function deleteSession(token: string): void {
  const db = getAuthDb();
  db.prepare("DELETE FROM sessions WHERE token = ?").run(token);
}

export function deleteExpiredSessions(): void {
  const db = getAuthDb();
  db.prepare("DELETE FROM sessions WHERE expires_at < datetime('now')").run();
}

export function getUserById(id: number): User | null {
  const db = getAuthDb();
  return db.prepare("SELECT * FROM users WHERE id = ?").get(id) as User | null;
}

export function updateUserPasswordHash(userId: number, newHash: string): void {
  const db = getAuthDb();
  db.prepare("UPDATE users SET password_hash = ? WHERE id = ?").run(newHash, userId);
}
