import { getScorecard } from "@/lib/store";
import { ensureSeedScorecards } from "@/lib/seed";

export async function GET(
  _req: Request,
  ctx: { params: Promise<{ id: string }> },
) {
  await ensureSeedScorecards();
  const { id } = await ctx.params;
  const card = await getScorecard(id);
  const score = card ? card.score.toFixed(1) : "?";
  const label = card ? card.productName.slice(0, 18) : "unknown";
  const color =
    !card ? "#666" : card.score >= 7 ? "#1a7f4b" : card.score >= 4 ? "#b36b00" : "#b42318";

  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="220" height="36" role="img" aria-label="first-skill-score">
  <title>first-skill-score: ${score}/10</title>
  <rect width="220" height="36" rx="6" fill="#0f1419"/>
  <rect x="1" y="1" width="218" height="34" rx="5" fill="none" stroke="#2a3340"/>
  <text x="12" y="23" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="#9aa4b2">first-skill</text>
  <text x="100" y="23" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" fill="#e8eef5">${label}</text>
  <rect x="168" y="6" width="44" height="24" rx="4" fill="${color}"/>
  <text x="190" y="23" text-anchor="middle" font-family="ui-monospace, SFMono-Regular, Menlo, monospace" font-size="12" font-weight="700" fill="#fff">${score}</text>
</svg>`;

  return new Response(svg, {
    headers: {
      "Content-Type": "image/svg+xml; charset=utf-8",
      "Cache-Control": "public, max-age=300",
    },
  });
}
