import type { Scorecard } from "./types";

/** A drop this size is a real regression, not fetch noise. */
export const REGRESSION_DELTA = 1.0;
const MAX_HISTORY = 12;

export interface RecheckOutcome {
  card: Scorecard;
  delta: number;
  regressed: boolean;
}

/**
 * Folds a fresh score into a card's history.
 *
 * The score is the product: a pack sold in January is worthless once the API
 * ships v2 in March. Tracking the drop is what turns a one-off report into a
 * reason to come back.
 */
export function applyRecheck(card: Scorecard, newScore: number, at: string): RecheckOutcome {
  const history = [...(card.history ?? [])];
  if (!history.length) history.push({ score: card.score, at: card.createdAt });

  const previous = history[history.length - 1].score;
  const delta = Math.round((newScore - previous) * 10) / 10;
  const regressed = delta <= -REGRESSION_DELTA;

  history.push({ score: newScore, at });

  return {
    card: {
      ...card,
      score: newScore,
      history: history.slice(-MAX_HISTORY),
      lastCheckedAt: at,
      regressed,
    },
    delta,
    regressed,
  };
}
