import { NextResponse } from "next/server";
import { listPublicScorecards } from "@/lib/store";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const niche = searchParams.get("niche");
  let cards = await listPublicScorecards();
  if (niche) cards = cards.filter((c) => c.niche === niche);
  return NextResponse.json({
    niche: niche ?? "all",
    count: cards.length,
    scorecards: cards,
  });
}
