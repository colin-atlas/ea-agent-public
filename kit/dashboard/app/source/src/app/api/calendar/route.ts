import { NextRequest, NextResponse } from "next/server";
import { execSync } from "child_process";
import { isDockerClient, getComposeDir } from "@/lib/openclaw-cli";
import path from "path";

const WORKSPACE = process.env.WORKSPACE_PATH || process.env.HOME + "/.openclaw/workspace";

function getWeekBounds(offsetWeeks = 0) {
  const now = new Date();
  const day = now.getDay(); // 0=Sun
  const sunday = new Date(now);
  sunday.setDate(now.getDate() - day + offsetWeeks * 7);
  sunday.setHours(0, 0, 0, 0);
  const saturday = new Date(sunday);
  saturday.setDate(sunday.getDate() + 7);
  return { start: sunday.toISOString(), end: saturday.toISOString() };
}

export function GET(req: NextRequest) {
  const offset = parseInt(req.nextUrl.searchParams.get("week") || "0");
  const { start, end } = getWeekBounds(offset);

  try {
    let result: string;

    if (isDockerClient()) {
      // Run google-api.sh inside the client's container where OAuth tokens live
      const composeDir = getComposeDir();
      result = execSync(
        `docker compose -f ${composeDir}/docker-compose.yml exec -T openclaw-gateway bash /home/node/.openclaw/workspace/scripts/google-api.sh calendar-range "${start}" "${end}"`,
        { env: { ...process.env, HOME: process.env.HOME || "/root" }, timeout: 15000, encoding: "utf-8" }
      );
    } else {
      // Bare-metal: run script directly on host
      const script = path.join(WORKSPACE, "scripts/google-api.sh");
      result = execSync(
        `bash ${script} calendar-range "${start}" "${end}"`,
        { env: { ...process.env, HOME: process.env.HOME || "/root" }, timeout: 10000, encoding: "utf-8" }
      );
    }

    const data = JSON.parse(result);
    const events = (data.items || []).map((e: Record<string, unknown>) => ({
      id: e.id,
      title: e.summary,
      start: (e.start as Record<string, string>)?.dateTime || (e.start as Record<string, string>)?.date,
      end: (e.end as Record<string, string>)?.dateTime || (e.end as Record<string, string>)?.date,
      allDay: !(e.start as Record<string, string>)?.dateTime,
      attendees: ((e.attendees as Record<string, string>[]) || []).map((a) => a.email),
      location: e.location,
      description: e.description,
      color: e.colorId,
    }));

    return NextResponse.json({ events, weekStart: start, weekEnd: end });
  } catch (err) {
    return NextResponse.json({ error: String(err), events: [], weekStart: start, weekEnd: end });
  }
}
