import { NextResponse } from "next/server";
import { listScorecards, upsertScorecard } from "@/lib/store";
import { runScorecardAnalysis } from "@/lib/analysis";
import { applyRecheck } from "@/lib/recheck";

export const maxDuration = 300;

/** Cron target. Re-scores real cards so a stale pack surfaces as a score drop. */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cards = (await listScorecards()).filter((c) => !c.seeded);
  const at = new Date().toISOString();
  const checked: { slug: string; delta: number; regressed: boolean }[] = [];

  for (const card of cards) {
    try {
      // Heuristic on purpose: a nightly sweep of every card through the live
      // agent would cost more than the packs earn.
      const analysis = await runScorecardAnalysis({
        productName: card.productName,
        docsUrl: card.docsUrl,
        openApiUrl: card.openApiUrl,
        niche: card.niche,
        jtbdId: card.jtbdId,
        customJtbd: card.jtbd,
        runnerMode: "heuristic",
      });
      const { card: updated, delta, regressed } = applyRecheck(card, analysis.score, at);
      await upsertScorecard({ ...updated, runs: analysis.runs, fixes: analysis.fixes });
      checked.push({ slug: card.slug, delta, regressed });
    } catch {
      // One unreachable site must not abort the sweep.
      continue;
    }
  }

  return NextResponse.json({
    checkedAt: at,
    checked: checked.length,
    regressed: checked.filter((c) => c.regressed),
  });
}
