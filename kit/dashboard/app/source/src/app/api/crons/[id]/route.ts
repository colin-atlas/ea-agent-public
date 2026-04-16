import { NextRequest, NextResponse } from "next/server";
import { openclawExec } from "@/lib/openclaw-cli";

export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();

  // Validate id is alphanumeric/dash/underscore only (prevent command injection)
  if (!/^[\w-]+$/.test(id)) {
    return NextResponse.json({ error: "Invalid cron job ID" }, { status: 400 });
  }

  try {
    if ("enabled" in body) {
      openclawExec(`cron edit ${id} --${body.enabled ? "enable" : "disable"}`);
    }
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json({ error: String(err) }, { status: 500 });
  }
}
