import type { AgentName, AgentRun, FailStep, RankedFix, ScoreRequest } from "./types";
import { getJtbd } from "./jtbds";
import { safeFetch } from "./safe-fetch";

export interface DocSignals {
  reachable: boolean;
  status?: number;
  hasLlmsTxt: boolean;
  hasOpenApiMention: boolean;
  hasMcpMention: boolean;
  hasCliMention: boolean;
  hasAuthDocs: boolean;
  hasApiKeyAuth: boolean;
  hasOauth: boolean;
  hasErrorDocs: boolean;
  hasCodeSamples: boolean;
  hasQuickstart: boolean;
  bodySnippet: string;
  error?: string;
}

/**
 * Heuristic first-success scorer.
 * Fetches docs + common agent surfaces, then simulates 3 agent runs.
 * When ANTHROPIC_API_KEY / OPENAI_API_KEY exist later, swap simulateRuns for live agents.
 */
export async function analyzeDocs(
  docsUrl: string,
  openApiUrl?: string,
): Promise<DocSignals> {
  const signals: DocSignals = {
    reachable: false,
    hasLlmsTxt: false,
    hasOpenApiMention: false,
    hasMcpMention: false,
    hasCliMention: false,
    hasAuthDocs: false,
    hasApiKeyAuth: false,
    hasOauth: false,
    hasErrorDocs: false,
    hasCodeSamples: false,
    hasQuickstart: false,
    bodySnippet: "",
  };

  try {
    const res = await safeFetch(docsUrl, {
      headers: { "User-Agent": "FirstSkillBot/1.0 (+https://firstskill.dev)" },
      timeoutMs: 12000,
    });
    signals.reachable = res.ok;
    signals.status = res.status;
    const text = res.text.slice(0, 120_000);
    signals.bodySnippet = text.slice(0, 2000);
    const lower = text.toLowerCase();

    signals.hasOpenApiMention =
      /openapi|swagger|\.yaml|\.json.*api/i.test(text) || Boolean(openApiUrl);
    signals.hasMcpMention = /\bmcp\b|model context protocol/i.test(text);
    signals.hasCliMention = /\bcli\b|command[- ]line|npx /i.test(text);
    signals.hasAuthDocs = /auth|api[_ ]?key|bearer|token/i.test(text);
    signals.hasApiKeyAuth = /api[_ ]?key|x-api-key/i.test(text);
    signals.hasOauth = /oauth|oidc|authorization code/i.test(text);
    signals.hasErrorDocs = /error code|status code|4\d\d|retry/i.test(text);
    signals.hasCodeSamples = /curl |```|fetch\(|axios/i.test(text);
    signals.hasQuickstart = /quickstart|getting started|5 minutes|in minutes/i.test(
      lower,
    );
  } catch (e) {
    signals.error = e instanceof Error ? e.message : "fetch failed";
  }

  try {
    const base = new URL(docsUrl);
    const candidates = [
      `${base.origin}/llms.txt`,
      `${base.origin}/.well-known/llms.txt`,
      docsUrl.replace(/\/?$/, "/llms.txt"),
    ];
    for (const url of candidates) {
      const r = await safeFetch(url, {
        headers: { "User-Agent": "FirstSkillBot/1.0" },
        timeoutMs: 6000,
      });
      if (r.ok) {
        const t = r.text;
        if (t.length > 40 && !t.trimStart().startsWith("<!")) {
          signals.hasLlmsTxt = true;
          break;
        }
      }
    }
  } catch {
    // ignore llms probe failures
  }

  if (openApiUrl) {
    try {
      const r = await safeFetch(openApiUrl, {
        headers: { "User-Agent": "FirstSkillBot/1.0" },
        timeoutMs: 8000,
      });
      if (r.ok) signals.hasOpenApiMention = true;
    } catch {
      // ignore
    }
  }

  return signals;
}

function scoreFromSignals(s: DocSignals): number {
  if (!s.reachable) return 1;
  let pts = 2;
  if (s.hasQuickstart) pts += 1;
  if (s.hasCodeSamples) pts += 1;
  if (s.hasAuthDocs && s.hasApiKeyAuth) pts += 1.5;
  else if (s.hasAuthDocs) pts += 0.5;
  if (s.hasOauth && !s.hasApiKeyAuth) pts -= 0.5; // agents struggle with interactive OAuth
  if (s.hasOpenApiMention) pts += 1.5;
  if (s.hasLlmsTxt) pts += 1;
  if (s.hasMcpMention) pts += 1;
  if (s.hasCliMention) pts += 1;
  if (s.hasErrorDocs) pts += 0.5;
  return Math.max(0, Math.min(10, Math.round(pts * 10) / 10));
}

/**
 * YOUR TURN (learning mode): refine fail-step attribution.
 * Map DocSignals + agent personality → the step where a real agent typically dies.
 * Keep return type FailStep. Good defaults already exist below — improve the edge cases.
 */
export function attributeFailStep(
  signals: DocSignals,
  agent: AgentName,
): FailStep {
  if (!signals.reachable) return "discovery";
  if (!signals.hasQuickstart && !signals.hasCodeSamples) return "docs";
  if (!signals.hasAuthDocs) return "auth";
  if (signals.hasOauth && !signals.hasApiKeyAuth) return "auth";
  if (!signals.hasOpenApiMention && !signals.hasMcpMention && !signals.hasCliMention) {
    return "tool-selection";
  }
  if (!signals.hasErrorDocs && agent === "cursor-agent") return "error-recovery";
  if (!signals.hasMcpMention && !signals.hasCliMention) return "api-call";
  return "none";
}

function simulateOneRun(
  agent: AgentName,
  signals: DocSignals,
  jtbdPrompt: string,
  baseScore: number,
): AgentRun {
  const failStep = attributeFailStep(signals, agent);
  // Agents with MCP/CLI bias succeed more often at higher base scores
  const agentBias: Record<AgentName, number> = {
    "claude-code": 0.05,
    "cursor-agent": 0,
    codex: -0.05,
  };
  const threshold = 0.55 - agentBias[agent];
  const successProb = Math.min(0.95, Math.max(0.05, baseScore / 10 + agentBias[agent]));
  // Deterministic-ish from product signals + agent name
  const hash = [...(signals.bodySnippet + agent)].reduce(
    (a, c) => a + c.charCodeAt(0),
    0,
  );
  const roll = (hash % 100) / 100;
  const success = signals.reachable && failStep === "none" && roll < successProb + 0.15
    ? true
    : signals.reachable && baseScore >= 7 && failStep === "none"
      ? roll < threshold + 0.4
      : failStep === "none" && roll < successProb;

  const actuallySucceeds = success && failStep === "none";
  const step = actuallySucceeds ? ("none" as FailStep) : failStep === "none" ? "api-call" : failStep;

  const transcript: string[] = [
    `[${agent}] Goal: ${jtbdPrompt.slice(0, 120)}…`,
    `[${agent}] Fetching docs… ${signals.reachable ? "ok" : "FAILED"}`,
  ];
  if (signals.hasLlmsTxt) transcript.push(`[${agent}] Found /llms.txt — using as index`);
  else transcript.push(`[${agent}] No llms.txt — crawling HTML`);

  if (step === "discovery") {
    transcript.push(`[${agent}] FAIL @ discovery — docs URL unreachable (${signals.error ?? signals.status})`);
  } else if (step === "docs") {
    transcript.push(`[${agent}] FAIL @ docs — no quickstart or code samples to follow`);
  } else if (step === "auth") {
    transcript.push(
      `[${agent}] FAIL @ auth — ${signals.hasOauth && !signals.hasApiKeyAuth ? "OAuth-only; no agent-friendly API key path" : "auth docs missing or ambiguous"}`,
    );
  } else if (step === "tool-selection") {
    transcript.push(`[${agent}] FAIL @ tool-selection — no OpenAPI / MCP / CLI surface discovered`);
  } else if (step === "api-call") {
    transcript.push(`[${agent}] Attempting primary API call…`);
    transcript.push(`[${agent}] FAIL @ api-call — ambiguous endpoint naming / missing required fields`);
  } else if (step === "error-recovery") {
    transcript.push(`[${agent}] API returned an error`);
    transcript.push(`[${agent}] FAIL @ error-recovery — no machine-readable error docs`);
  } else {
    transcript.push(`[${agent}] Auth ok → tool selected → API call succeeded`);
    transcript.push(`[${agent}] SUCCESS — JTBD completed`);
  }

  return {
    agent,
    success: actuallySucceeds,
    failStep: step,
    durationMs: 8000 + (hash % 12000),
    transcript,
    notes: actuallySucceeds
      ? "Agent completed the JTBD without human intervention."
      : `Stopped at ${step}.`,
  };
}

export function simulateRuns(
  signals: DocSignals,
  jtbdPrompt: string,
): AgentRun[] {
  const base = scoreFromSignals(signals);
  const agents: AgentName[] = ["claude-code", "cursor-agent", "codex"];
  return agents.map((a) => simulateOneRun(a, signals, jtbdPrompt, base));
}

export function rankedFixes(signals: DocSignals, runs: AgentRun[]): RankedFix[] {
  const failCounts = new Map<FailStep, number>();
  for (const r of runs) {
    if (!r.success) failCounts.set(r.failStep, (failCounts.get(r.failStep) ?? 0) + 1);
  }

  const fixes: RankedFix[] = [];
  let p = 1;

  const push = (title: string, detail: string) => {
    fixes.push({ priority: p++, title, detail });
  };

  if (!signals.reachable) {
    push("Make docs publicly reachable", "Agents cannot start if the docs URL 404s or blocks bots.");
  }
  if (!signals.hasLlmsTxt) {
    push(
      "Ship /llms.txt",
      "Add a machine-readable docs index at /llms.txt so agents stop crawling HTML.",
    );
  }
  if (!signals.hasOpenApiMention) {
    push(
      "Publish OpenAPI",
      "Expose a stable OpenAPI 3 spec URL. Agents invent endpoints when they cannot read a contract.",
    );
  }
  if (signals.hasOauth && !signals.hasApiKeyAuth) {
    push(
      "Add an API-key path for agents",
      "OAuth-only flows kill unattended agents. Offer scoped API keys or device-code auth.",
    );
  } else if (!signals.hasAuthDocs) {
    push("Document auth in one page", "Put create-key → header → first request on a single quickstart page.");
  }
  if (!signals.hasMcpMention && !signals.hasCliMention) {
    push(
      "Ship a CLI or MCP server",
      "Agents prefer callable surfaces over click-paths. A thin CLI or MCP beats a pretty dashboard.",
    );
  }
  if (!signals.hasErrorDocs) {
    push(
      "Write agent-recoverable errors",
      "Return stable error codes + remediation text. Agents retry blindly without them.",
    );
  }
  if (!signals.hasCodeSamples || !signals.hasQuickstart) {
    push(
      "Add a 5-minute JTBD quickstart",
      "One copy-paste path for the primary job-to-be-done with real request/response pairs.",
    );
  }

  // Always recommend an official skill as the FirstSkill wedge
  push(
    "Publish an official agent skill",
    "A tested SKILL.md with auth, endpoints, and gotchas is how agents keep choosing you. FirstSkill packs this.",
  );

  return fixes.slice(0, 6);
}

export function computeScore(runs: AgentRun[], signals: DocSignals): {
  score: number;
  successRate: number;
} {
  const successes = runs.filter((r) => r.success).length;
  const successRate = successes / runs.length;
  const signalScore = scoreFromSignals(signals);
  // Blend: 60% run success, 40% surface quality
  const blended = successRate * 10 * 0.6 + signalScore * 0.4;
  return {
    score: Math.round(blended * 10) / 10,
    successRate,
  };
}

import { runLiveAgentEvaluation } from "./live-runner";

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
  const fixes = rankedFixes(signals, runs);
  return { jtbd, signals, runs, score, successRate, fixes, runnerMode: req.runnerMode ?? "heuristic" };
}

