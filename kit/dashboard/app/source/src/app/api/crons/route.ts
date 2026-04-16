import { NextResponse } from "next/server";
import { getCronJobs, openclawExec } from "@/lib/openclaw-cli";

export function GET() {
  try {
    const jobs = getCronJobs();
    return NextResponse.json({ jobs });
  } catch (err) {
    // Fallback: try without --json
    try {
      const raw = openclawExec("cron list");
      return NextResponse.json({ jobs: [], raw, error: "JSON parse failed, raw output returned" });
    } catch (e) {
      return NextResponse.json({ jobs: [], error: String(e) });
    }
  }
}
