import { NextResponse } from "next/server";
import { getScorecard } from "@/lib/store";
import { ensureSeedScorecards } from "@/lib/seed";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeedScorecards();
  const { id } = await ctx.params;
  const card = await getScorecard(id);
  if (!card) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ scorecard: card });
}
