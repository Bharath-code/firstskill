import { notFound } from "next/navigation";
import { ScorecardView } from "@/components/ScorecardView";
import { getScorecard } from "@/lib/store";

export default async function ScoreDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const card = await getScorecard(id);
  if (!card) notFound();
  return <ScorecardView card={card} />;
}
