import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export const dynamic = "force-dynamic";

export function GET() {
  const db = getDb();
  const alerts = db.prepare(
    `SELECT * FROM alerts WHERE status = 'active' ORDER BY created_at DESC LIMIT 20`
  ).all();
  return NextResponse.json({ alerts });
}

export function PATCH(req: NextRequest) {
  return req.json().then((body) => {
    const db = getDb();
    const { id, status, resolved_note } = body;
    if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });
    db.prepare(
      `UPDATE alerts SET status = ?, resolved_note = ?, resolved_at = datetime('now') WHERE id = ?`
    ).run(status || "resolved", resolved_note || "", id);
    return NextResponse.json({ ok: true });
  });
}
