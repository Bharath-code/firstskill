import type { Scorecard } from "./types";

export interface RegressionAlert {
  /** Slack renders `text`; Discord renders `content`. Sending both fits either
   * webhook without asking the customer which one they pasted in. */
  text: string;
  content: string;
  product: string;
  slug: string;
  previousScore: number;
  newScore: number;
  delta: number;
  failStep: string;
  reportUrl: string;
  checkedAt: string;
}

/** First step that actually broke; "none" when every run finished. */
function firstFailStep(card: Scorecard): string {
  return card.runs.find((r) => !r.success)?.failStep ?? "none";
}

export function buildRegressionAlert(
  card: Scorecard,
  delta: number,
  at: string,
  origin: string,
): RegressionAlert {
  const previousScore = Math.round((card.score - delta) * 10) / 10;
  const failStep = firstFailStep(card);
  const reportUrl = `${origin}/score/${card.slug}`;
  const line =
    `${card.productName}: agent success dropped ${Math.abs(delta).toFixed(1)} pts ` +
    `(${previousScore.toFixed(1)} → ${card.score.toFixed(1)}). ` +
    `Fails at ${failStep}. ${reportUrl}`;

  return {
    text: line,
    content: line,
    product: card.productName,
    slug: card.slug,
    previousScore,
    newScore: card.score,
    delta,
    failStep,
    reportUrl,
    checkedAt: at,
  };
}
