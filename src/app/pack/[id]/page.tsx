import { notFound } from "next/navigation";
import { PackView } from "@/components/PackView";
import { getPack } from "@/lib/store";
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
  return <PackView pack={pack} />;
}
