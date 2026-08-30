import type { RunnerMode } from "./types";

/**
 * Publication gate.
 *
 * Heuristic and live-probe scores are estimates. Publishing an estimate under a
 * named company's brand — badge, leaderboard, shared report — is the one claim
 * this product cannot defend, so the gate sits on publication, not on scoring:
 * you can still score anything you like, privately.
 */
export function isPublishable(card: { runnerMode?: RunnerMode }): boolean {
  return card.runnerMode === "agent";
}

export const UNRATED_REASON =
  "Estimate only — not a real agent run, so it is not published.";
