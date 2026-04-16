import { NextRequest, NextResponse } from "next/server";
import { getDb } from "@/lib/db";

export function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  return Promise.all([req.json(), params]).then(([body, { id }]) => {
    const db = getDb();
    const fields = ["name", "description", "status"];
    for (const field of fields) {
      if (body[field] !== undefined) {
        db.prepare(`UPDATE projects SET ${field} = ? WHERE id = ?`).run(body[field], id);
      }
    }
    const updated = db.prepare("SELECT * FROM projects WHERE id = ?").get(id);
    return NextResponse.json(updated);
  });
}
