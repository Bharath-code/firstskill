import type { NextRequest } from "next/server";
import { Webhooks } from "@dodopayments/nextjs";
import { getPack, upsertPack } from "@/lib/store";

/**
 * Dodo Payments webhook — the ONLY place a skill pack is marked purchased.
 * Signature is verified by the adapter using DODO_PAYMENTS_WEBHOOK_SECRET.
 */
export async function POST(req: NextRequest) {
  const webhookKey = process.env.DODO_PAYMENTS_WEBHOOK_SECRET;
  // Built lazily: the adapter throws on an empty secret at construction time.
  if (!webhookKey) {
    return Response.json({ error: "Webhook not configured" }, { status: 503 });
  }

  return Webhooks({
    webhookKey,
    onPaymentSucceeded: async (payload) => {
      const packId = payload.data.metadata?.packId;
      if (typeof packId !== "string") return;

      const pack = await getPack(packId);
      if (!pack) return;

      // Idempotent: Dodo retries webhooks, and metrics derive from this row.
      if (pack.status === "purchased") return;

      await upsertPack({ ...pack, status: "purchased" });
    },
  })(req);
}
