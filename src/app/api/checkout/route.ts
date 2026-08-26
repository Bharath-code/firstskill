import { NextResponse } from "next/server";
import DodoPayments from "dodopayments";
import { getPack } from "@/lib/store";

/**
 * Creates a Dodo Payments checkout session for a skill pack.
 * Purchase state is NOT set here — only the verified webhook may unlock a pack.
 */
export async function POST(req: Request) {
  const body = (await req.json()) as { packId?: string };
  if (!body.packId) {
    return NextResponse.json({ error: "packId required" }, { status: 400 });
  }

  const pack = await getPack(body.packId);
  if (!pack) {
    return NextResponse.json({ error: "Pack not found" }, { status: 404 });
  }
  if (pack.status === "purchased") {
    return NextResponse.json({ alreadyPurchased: true, redirectUrl: `/pack/${pack.id}` });
  }

  const bearerToken = process.env.DODO_PAYMENTS_API_KEY;
  const productId = process.env.DODO_PACK_PRODUCT_ID;
  if (!bearerToken || !productId) {
    return NextResponse.json(
      {
        error: "Payments not configured",
        hint: "Set DODO_PAYMENTS_API_KEY and DODO_PACK_PRODUCT_ID (see .env.example).",
      },
      { status: 503 },
    );
  }

  const origin = process.env.NEXT_PUBLIC_APP_URL ?? new URL(req.url).origin;
  const client = new DodoPayments({
    bearerToken,
    environment: process.env.DODO_PAYMENTS_ENVIRONMENT === "live_mode" ? "live_mode" : "test_mode",
  });

  try {
    const session = await client.checkoutSessions.create({
      product_cart: [{ product_id: productId, quantity: 1 }],
      return_url: `${origin}/pack/${pack.id}?paid=1`,
      // Read back in the webhook — the only place a pack is unlocked.
      metadata: { packId: pack.id, scorecardId: pack.scorecardId },
    });

    if (!session.checkout_url) {
      return NextResponse.json({ error: "Dodo returned no checkout URL" }, { status: 502 });
    }
    return NextResponse.json({ checkoutUrl: session.checkout_url });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Checkout session failed";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
