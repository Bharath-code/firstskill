import { NextResponse } from "next/server";
import type { ScoreRequest } from "@/lib/types";
import { runScorecardAnalysis } from "@/lib/scorer";
import {
  newId,
  slugify,
  upsertScorecard,
} from "@/lib/store";
import { ensureSeedScorecards } from "@/lib/seed";
import { getJtbd } from "@/lib/jtbds";
import { assertPublicUrl, BlockedUrlError } from "@/lib/safe-fetch";

export async function POST(req: Request) {
  await ensureSeedScorecards();
  const body = (await req.json()) as ScoreRequest;

  if (!body.productName?.trim() || !body.docsUrl?.trim() || !body.niche || !body.jtbdId) {
    return NextResponse.json(
      { error: "productName, docsUrl, niche, and jtbdId are required" },
      { status: 400 },
    );
  }

  try {
    await assertPublicUrl(body.docsUrl);
    if (body.openApiUrl?.trim()) await assertPublicUrl(body.openApiUrl.trim());
  } catch (e) {
    const message =
      e instanceof BlockedUrlError ? e.message : "docsUrl must be a valid URL";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const analysis = await runScorecardAnalysis(body);
  const id = newId("score");
  const baseSlug = slugify(body.productName);
  const slug = `${baseSlug}-${id.slice(-6)}`;

  const card = await upsertScorecard({
    id,
    slug,
    productName: body.productName.trim(),
    docsUrl: body.docsUrl.trim(),
    openApiUrl: body.openApiUrl?.trim() || undefined,
    niche: body.niche,
    jtbd: analysis.jtbd,
    jtbdId: body.jtbdId,
    email: body.email?.trim() || undefined,
    score: analysis.score,
    successRate: analysis.successRate,
    runs: analysis.runs,
    fixes: analysis.fixes,
    public: body.makePublic !== false,
    seeded: false,
    createdAt: new Date().toISOString(),
    runnerMode: body.runnerMode ?? "heuristic",
  });


  return NextResponse.json({
    scorecard: card,
    signals: analysis.signals,
    jtbdLabel: getJtbd(body.jtbdId)?.label,
  });
}
