import { NextResponse } from "next/server";
import type { PackRequest } from "@/lib/types";
import { getScorecard, upsertScorecard, upsertPack } from "@/lib/store";
import { generateSkillPack, packAsZipManifest } from "@/lib/skill-generator";
import { ensureSeedScorecards } from "@/lib/seed";

export async function POST(req: Request) {
  await ensureSeedScorecards();
  const body = (await req.json()) as PackRequest;
  if (!body.scorecardId || !body.email?.includes("@")) {
    return NextResponse.json(
      { error: "scorecardId and a valid email are required" },
      { status: 400 },
    );
  }

  const card = await getScorecard(body.scorecardId);
  if (!card) {
    return NextResponse.json({ error: "Scorecard not found" }, { status: 404 });
  }

  const pack = generateSkillPack(card);
  pack.status = "ready";
  await upsertPack(pack);
  await upsertScorecard({ ...card, skillPackId: pack.id, email: body.email });

  // Paid files are served only from the gated pack page after a verified payment.
  return NextResponse.json({
    packId: pack.id,
    productName: pack.productName,
    fileNames: Object.keys(packAsZipManifest(pack)),
    checkoutPath: `/pack/${pack.id}`,
    price: {
      earlyBirdCents: 19700,
      standardCents: 29700,
      currency: "usd",
    },
  });
}
