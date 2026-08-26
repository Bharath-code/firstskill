import type { ScoreRequest } from "./types";
import { getJtbd } from "./jtbds";
import { analyzeDocs, computeScore, rankedFixes, simulateRuns } from "./scorer";
import { runLiveAgentEvaluation } from "./live-runner";

/**
 * Composes the scorer and the live runner. Lives outside scorer.ts so that
 * scorer -> live-runner -> scorer is not an import cycle.
 */
export async function runScorecardAnalysis(req: ScoreRequest) {
  const jtbd =
    req.customJtbd?.trim() ||
    getJtbd(req.jtbdId)?.prompt ||
    "Complete the primary API job documented on the site.";

  const signals = await analyzeDocs(req.docsUrl, req.openApiUrl);

  const runs =
    req.runnerMode === "live"
      ? await runLiveAgentEvaluation(signals, jtbd, req.docsUrl, req.openApiUrl)
      : simulateRuns(signals, jtbd);

  const { score, successRate } = computeScore(runs, signals);
  const fixes = rankedFixes(signals);

  return {
    jtbd,
    signals,
    runs,
    score,
    successRate,
    fixes,
    runnerMode: req.runnerMode ?? "heuristic",
  };
}
