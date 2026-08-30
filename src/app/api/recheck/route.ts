import { NextResponse } from "next/server";
import { listScorecards, upsertScorecard } from "@/lib/store";
import { runScorecardAnalysis } from "@/lib/analysis";
import { applyRecheck } from "@/lib/recheck";
import { buildRegressionAlert } from "@/lib/alert";
import { safeFetch } from "@/lib/safe-fetch";

export const maxDuration = 300;

interface Checked {
  slug: string;
  delta: number;
  regressed: boolean;
  notified?: boolean;
  error?: string;
}

/**
 * Cron target for the watch subscription.
 *
 * Only watched cards are swept, and each one is re-run through a real agent:
 * the alert is what the customer pays for, so a heuristic re-score would be
 * both a false alarm and a false all-clear.
 */
export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://firstskill.dev";
  const cards = (await listScorecards()).filter((c) => c.watched && !c.seeded);
  const at = new Date().toISOString();
  const checked: Checked[] = [];

  for (const card of cards) {
    try {
      const analysis = await runScorecardAnalysis({
        productName: card.productName,
        docsUrl: card.docsUrl,
        openApiUrl: card.openApiUrl,
        niche: card.niche,
        jtbdId: card.jtbdId,
        customJtbd: card.jtbd,
        runnerMode: "agent",
      });
      const { card: updated, delta, regressed } = applyRecheck(card, analysis.score, at);
      const saved = {
        ...updated,
        runs: analysis.runs,
        fixes: analysis.fixes,
        runnerMode: analysis.runnerMode,
      };
      await upsertScorecard(saved);

      const row: Checked = { slug: card.slug, delta, regressed };
      if (regressed && card.notifyUrl) {
        try {
          const alert = buildRegressionAlert(saved, delta, at, origin);
          const res = await safeFetch(card.notifyUrl, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(alert),
          });
          row.notified = res.ok;
          if (!res.ok) row.error = `webhook returned ${res.status}`;
        } catch (e) {
          // A dead webhook is the customer's problem to see, not ours to hide.
          row.notified = false;
          row.error = e instanceof Error ? e.message : "webhook failed";
        }
      }
      checked.push(row);
    } catch (e) {
      // One unreachable site must not abort the sweep — but it is reported.
      checked.push({
        slug: card.slug,
        delta: 0,
        regressed: false,
        error: e instanceof Error ? e.message : "recheck failed",
      });
    }
  }

  return NextResponse.json({
    checkedAt: at,
    watched: cards.length,
    checked: checked.length,
    regressed: checked.filter((c) => c.regressed),
    failed: checked.filter((c) => c.error),
  });
}
