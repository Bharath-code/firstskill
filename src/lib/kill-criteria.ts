import type { Metrics } from "./store";

export type KillStatus = "tracking" | "pass" | "kill";

export interface KillEvaluation {
  daysLeft: number;
  usersOk: boolean;
  paidOk: boolean;
  status: KillStatus;
  summary: string;
}

/**
 * Evaluates the 30-day GO/NO-GO gate.
 * Lives outside the component tree: reading the clock during render is impure
 * (react-hooks/purity), and both the page and /api/metrics need the same answer.
 */
export function evaluateKillCriteria(metrics: Metrics, now: number = Date.now()): KillEvaluation {
  const killAt = new Date(metrics.killAt).getTime();
  const daysLeft = Math.max(0, Math.ceil((killAt - now) / (24 * 60 * 60 * 1000)));
  const usersOk = metrics.scorecardUsers >= metrics.killCriteria.minScorecardUsers;
  const paidOk = metrics.paidConversations >= metrics.killCriteria.minPaidConversations;
  const windowEnded = now >= killAt;

  const status: KillStatus =
    usersOk && paidOk ? "pass" : windowEnded ? "kill" : "tracking";

  return {
    daysLeft,
    usersOk,
    paidOk,
    status,
    summary:
      status === "kill"
        ? "NO-GO: kill criteria missed after 30 days."
        : status === "pass"
          ? "GO: thresholds met — continue."
          : `Tracking: need ${metrics.killCriteria.minScorecardUsers} score users and ${metrics.killCriteria.minPaidConversations} paid conversations within ${metrics.killCriteria.windowDays} days.`,
  };
}
