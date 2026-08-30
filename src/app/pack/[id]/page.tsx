import { notFound } from "next/navigation";
import { PackView } from "@/components/PackView";
import { getPack } from "@/lib/store";
import { packAsZipManifest } from "@/lib/skill-generator";
import { ensureSeedScorecards } from "@/lib/seed";

export default async function PackPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  await ensureSeedScorecards();
  const { id } = await params;
  const pack = await getPack(id);
  if (!pack) notFound();

  const unlocked = pack.status === "purchased";
  const manifest = packAsZipManifest(pack);

  return (
    <PackView
      pack={{
        id: pack.id,
        productName: pack.productName,
        jtbd: pack.jtbd,
        beforeScore: pack.beforeScore,
        afterScore: pack.afterScore,
        verifiedAt: pack.verifiedAt,
        status: pack.status,
      }}
      // Paid content crosses the network only after a verified payment.
      files={unlocked ? manifest : null}
      fileNames={Object.keys(manifest)}
      teaser={pack.skillMd.split("\n").slice(0, 18).join("\n")}
    />
  );
}
