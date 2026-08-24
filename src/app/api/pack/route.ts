import { NextResponse } from "next/server";
import type { PackRequest } from "@/lib/types";
import { getScorecard, upsertScorecard, upsertPack, bumpPaidConversation } from "@/lib/store";
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
  // Intent signal toward paid conversation / checkout
  await bumpPaidConversation();

  return NextResponse.json({
    pack,
    files: packAsZipManifest(pack),
    checkoutPath: `/pack/${pack.id}?email=${encodeURIComponent(body.email)}`,
    price: {
      earlyBirdCents: 19700,
      standardCents: 29700,
      currency: "usd",
    },
  });
}
