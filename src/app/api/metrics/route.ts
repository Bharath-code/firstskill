import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/store";
import { evaluateKillCriteria } from "@/lib/kill-criteria";
import { ensureSeedScorecards } from "@/lib/seed";

export async function GET() {
  await ensureSeedScorecards();
  const metrics = await getMetrics();
  const { daysLeft, status, summary } = evaluateKillCriteria(metrics);

  return NextResponse.json({ ...metrics, daysLeft, status, summary });
}
