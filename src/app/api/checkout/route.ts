import { NextResponse } from "next/server";
import { getPack, bumpPackPurchase, upsertPack } from "@/lib/store";
import { packAsZipManifest } from "@/lib/skill-generator";

/**
 * Checkout stub — wires Stripe later via STRIPE_SECRET_KEY.
 * Marks pack purchased and returns downloadable file manifest.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { packId: string; mode?: "simulate" | "stripe" };
  if (!body.packId) {
    return NextResponse.json({ error: "packId required" }, { status: 400 });
  }

  const pack = await getPack(body.packId);
  if (!pack) {
    return NextResponse.json({ error: "Pack not found" }, { status: 404 });
  }

  const stripeKey = process.env.STRIPE_SECRET_KEY;
  if (body.mode === "stripe" && stripeKey) {
    return NextResponse.json({
      error: "Stripe Checkout session creation not configured in this MVP build",
      hint: "Use mode=simulate for now, or add Stripe session creation.",
    }, { status: 501 });
  }

  const purchased = { ...pack, status: "purchased" as const };
  await upsertPack(purchased);
  await bumpPackPurchase();

  return NextResponse.json({
    ok: true,
    pack: purchased,
    files: packAsZipManifest(purchased),
    message: "Simulated purchase complete. Download files from the response or pack page.",
  });
}
