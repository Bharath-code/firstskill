import { NextResponse } from "next/server";
import { getPack, getScorecard, upsertPack } from "@/lib/store";
import { runAgentEvaluation, NoAgentCredentialsError } from "@/lib/agent-runner";
import { analyzeDocs, computeScore } from "@/lib/scorer";

/**
 * Re-runs the same evaluation with the pack installed and records the result.
 *
 * This is the only thing allowed to set afterScore. The before/after claim is
 * what justifies the price, so it has to come from a second real run.
 */
export async function POST(req: Request) {
  const { packId } = (await req.json()) as { packId?: string };
  if (!packId) {
    return NextResponse.json({ error: "packId is required" }, { status: 400 });
  }

  const pack = await getPack(packId);
  if (!pack) return NextResponse.json({ error: "Pack not found" }, { status: 404 });

  const card = await getScorecard(pack.scorecardId);
  if (!card) return NextResponse.json({ error: "Scorecard not found" }, { status: 404 });

  let run;
  try {
    run = await runAgentEvaluation(card.jtbd, card.docsUrl, card.openApiUrl, pack.skillMd);
  } catch (e) {
    const message =
      e instanceof NoAgentCredentialsError
        ? "Verification needs a configured agent runner. Nothing was claimed."
        : "Verification run failed. Nothing was claimed.";
    return NextResponse.json({ error: message }, { status: 503 });
  }

  const signals = await analyzeDocs(card.docsUrl, card.openApiUrl);
  const { score } = computeScore([run], signals);

  const verified = {
    ...pack,
    afterScore: score,
    verifiedAt: new Date().toISOString(),
  };
  await upsertPack(verified);

  return NextResponse.json({
    packId: verified.id,
    beforeScore: verified.beforeScore,
    afterScore: verified.afterScore,
    verifiedAt: verified.verifiedAt,
    run,
  });
}
