import { NextResponse } from "next/server";
import { getMetrics } from "@/lib/store";
import { ensureSeedScorecards } from "@/lib/seed";

export async function GET() {
  await ensureSeedScorecards();
  const metrics = await getMetrics();
  const now = Date.now();
  const killAt = new Date(metrics.killAt).getTime();
  const daysLeft = Math.max(0, Math.ceil((killAt - now) / (24 * 60 * 60 * 1000)));
  const usersOk = metrics.scorecardUsers >= metrics.killCriteria.minScorecardUsers;
  const paidOk = metrics.paidConversations >= metrics.killCriteria.minPaidConversations;
  const windowEnded = now >= killAt;

  let status: "tracking" | "pass" | "kill" = "tracking";
  if (windowEnded) {
    status = usersOk && paidOk ? "pass" : "kill";
  } else if (usersOk && paidOk) {
    status = "pass";
  }

  return NextResponse.json({
    ...metrics,
    daysLeft,
    status,
    summary:
      status === "kill"
        ? "NO-GO: kill criteria missed after 30 days."
        : status === "pass"
          ? "GO: thresholds met — continue."
          : `Tracking: need ${metrics.killCriteria.minScorecardUsers} score users and ${metrics.killCriteria.minPaidConversations} paid conversations within ${metrics.killCriteria.windowDays} days.`,
  });
}
