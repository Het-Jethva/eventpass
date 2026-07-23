import { NextResponse } from "next/server";
import { cleanupDisposableArtifacts } from "@/features/maintenance/server/cleanup-disposable-artifacts";

export async function GET(request: Request) {
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;

  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const summary = await cleanupDisposableArtifacts();
    return NextResponse.json({ ok: true, summary });
  } catch (error) {
    return NextResponse.json(
      { ok: false, error: error instanceof Error ? error.message : "Cleanup failed" },
      { status: 500 },
    );
  }
}
