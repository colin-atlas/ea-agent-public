import crypto from "crypto";
import bcrypt from "bcryptjs";
import { cookies } from "next/headers";
import { getSessionByToken } from "./auth-db";

const SALT_ROUNDS = 12;
const DURATION_DAYS = parseInt(process.env.SESSION_DURATION_DAYS || "30");

export const COOKIE_NAME = process.env.SESSION_COOKIE_NAME || "ea-dashboard-session";

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function generateToken(): string {
  return crypto.randomBytes(32).toString("hex");
}

export function getExpiresAt(): string {
  const d = new Date();
  d.setDate(d.getDate() + DURATION_DAYS);
  return d.toISOString();
}

export interface SessionUser {
  id: number;
  email: string;
  fullName: string | null;
  role: string;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;

  const session = getSessionByToken(token);
  if (!session) return null;

  if (new Date(session.expires_at) < new Date()) return null;

  return {
    id: session.user_id,
    email: session.email,
    fullName: session.full_name,
    role: session.role,
  };
}
