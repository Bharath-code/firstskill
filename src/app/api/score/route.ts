import { NextResponse } from "next/server";
import type { ScoreRequest } from "@/lib/types";
import { runScorecardAnalysis } from "@/lib/analysis";
import {
  newId,
  slugify,
  upsertScorecard,
} from "@/lib/store";
import { getJtbd } from "@/lib/jtbds";
import { assertPublicUrl, BlockedUrlError } from "@/lib/safe-fetch";
import { isPublishable } from "@/lib/publish-gate";

export async function POST(req: Request) {
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
    // The webhook is a server-side POST to a user-supplied URL: same SSRF
    // surface as the docs fetch, so it goes through the same guard.
    if (body.notifyUrl?.trim()) await assertPublicUrl(body.notifyUrl.trim());
  } catch (e) {
    const message =
      e instanceof BlockedUrlError ? e.message : "docsUrl must be a valid URL";
    return NextResponse.json({ error: message }, { status: 400 });
  }

  const analysis = await runScorecardAnalysis(body);
  // Only a real agent run may carry a company's name in public.
  const publishable = isPublishable({ runnerMode: analysis.runnerMode });
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
    public: publishable && body.makePublic !== false,
    seeded: false,
    createdAt: new Date().toISOString(),
    runnerMode: analysis.runnerMode,
    watched: body.watch === true,
    notifyUrl: body.notifyUrl?.trim() || undefined,
  });


  return NextResponse.json({
    scorecard: card,
    signals: analysis.signals,
    runnerNote: analysis.runnerNote,
    publishable,
    jtbdLabel: getJtbd(body.jtbdId)?.label,
  });
}
