import type { RunnerMode, ScoreRequest } from "./types";
import { getJtbd } from "./jtbds";
import { analyzeDocs, computeScore, rankedFixes, simulateRuns } from "./scorer";
import { runLiveAgentEvaluation } from "./live-runner";
import { runAgentEvaluation, NoAgentCredentialsError } from "./agent-runner";

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

  let runnerMode: RunnerMode = req.runnerMode ?? "heuristic";
  let runnerNote: string | undefined;
  let runs;

  if (runnerMode === "agent") {
    try {
      runs = [await runAgentEvaluation(jtbd, req.docsUrl, req.openApiUrl)];
    } catch (e) {
      // Degrade loudly. Reporting a heuristic score as a real agent run is the
      // one lie this product cannot afford.
      runnerMode = "heuristic";
      runnerNote =
        e instanceof NoAgentCredentialsError
          ? "No agent credentials configured — this is a heuristic estimate, not a real agent run."
          : "Agent run failed to start — this is a heuristic estimate, not a real agent run.";
      runs = simulateRuns(signals, jtbd);
    }
  } else if (runnerMode === "live") {
    runs = await runLiveAgentEvaluation(signals, jtbd, req.docsUrl, req.openApiUrl);
  } else {
    runs = simulateRuns(signals, jtbd);
  }

  const { score, successRate } = computeScore(runs, signals);
  const fixes = rankedFixes(signals);

  return {
    jtbd,
    signals,
    runs,
    score,
    successRate,
    fixes,
    runnerMode,
    runnerNote,
  };
}
