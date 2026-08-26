import type { AgentName, AgentRun, FailStep, RankedFix } from "./types";
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
  /** Wall-clock time of the docs fetch, reused by the live probe. */
  latencyMs?: number;
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

  const startedAt = performance.now();
  try {
    const res = await safeFetch(docsUrl, {
      headers: { "User-Agent": "FirstSkillBot/1.0 (+https://firstskill.dev)" },
      timeoutMs: 12000,
    });
    signals.latencyMs = Math.round(performance.now() - startedAt);
    signals.reachable = res.ok;
    signals.status = res.status;
    const html = res.text.slice(0, 120_000);
    signals.bodySnippet = html.slice(0, 2000);
    Object.assign(signals, detectSignals(html, Boolean(openApiUrl)));
  } catch (e) {
    signals.latencyMs = Math.round(performance.now() - startedAt);
    signals.error = e instanceof Error ? e.message : "fetch failed";
  }

  let candidates: string[] = [];
  try {
    const base = new URL(docsUrl);
    candidates = [
      `${base.origin}/llms.txt`,
      `${base.origin}/.well-known/llms.txt`,
      docsUrl.replace(/\/?$/, "/llms.txt"),
    ];
  } catch {
    // unparseable docsUrl — nothing to probe
  }

  for (const url of candidates) {
    // Per-candidate catch: a network error on the first path must not skip the rest.
    try {
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
    } catch {
      // try the next candidate
    }
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

/**
 * A 4xx/5xx literal only counts as error documentation when error vocabulary sits
 * in the same sentence. A bare `\b[45]\d\d\b` matched "$499" and "500 companies",
 * which made hasErrorDocs true on almost every marketing page.
 */
const STATUS_CODE_IN_CONTEXT =
  /\b[45]\d\d\b[^.!?]{0,40}\b(error|status|response|returns?|returned|means|indicates)\b|\b(error|status|response|returns?|throws?|http)\b[^.!?]{0,40}\b[45]\d\d\b/i;

/** Markup that carries no prose: scripts, styles, and the tags themselves. */
function toVisibleText(html: string): string {
  return html
    .replace(/<script\b[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[\s\S]*?<\/style>/gi, " ")
    .replace(/<[^>]+>/g, " ");
}

/**
 * Content signals, matched against visible prose rather than raw markup.
 *
 * Matching raw HTML made these near-universally true: `<meta name="author">` lit
 * up hasAuthDocs, `width:400px` lit up hasErrorDocs, and an unanchored
 * `/\.json.*api/` matched any page with both strings anywhere in 120KB. The
 * result was ~+3.5 on nearly every reachable site, compressing the 0-10 range.
 */
export function detectSignals(
  html: string,
  hasOpenApiUrl = false,
): Pick<
  DocSignals,
  | "hasOpenApiMention"
  | "hasMcpMention"
  | "hasCliMention"
  | "hasAuthDocs"
  | "hasApiKeyAuth"
  | "hasOauth"
  | "hasErrorDocs"
  | "hasCodeSamples"
  | "hasQuickstart"
> {
  const text = toVisibleText(html);
  // Code samples are markup, not prose, so they are detected on the raw HTML.
  const hasCodeBlock = /<pre\b|<code\b|```/i.test(html);

  return {
    hasOpenApiMention:
      hasOpenApiUrl || /\bopenapi\b|\bswagger\b|openapi\.(json|ya?ml)/i.test(text),
    hasMcpMention: /\bmcp\b|model context protocol/i.test(text),
    hasCliMention: /\bcli\b|command[- ]line|\bnpx\b/i.test(text),
    // \bauth\b so "author" does not count as auth documentation.
    hasAuthDocs:
      /\bauth\b|\bauthentication\b|\bauthorization\b|api[_ -]?key|bearer token|access token/i.test(
        text,
      ),
    hasApiKeyAuth: /api[_ -]?key|x-api-key/i.test(text),
    hasOauth: /\boauth\b|\boidc\b|authorization code/i.test(text),
    hasErrorDocs:
      /error code|status code|error handling|\brate limit|\bretry\b/i.test(text) ||
      STATUS_CODE_IN_CONTEXT.test(text),
    hasCodeSamples: hasCodeBlock || /\bcurl\b|fetch\(|\baxios\b/i.test(text),
    hasQuickstart: /quickstart|quick start|getting started|in \d+ minutes/i.test(text),
  };
}

/** Credit every agent gets for a surface that already clears every fail step. */
const BASE_SUCCESS_BONUS = 0.15;

const clamp = (n: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, n));

const AGENT_SALT: Record<AgentName, number> = {
  "claude-code": 0,
  "cursor-agent": 4111,
  codex: 8219,
};

/**
 * FNV-1a over the boolean signal flags. Keyed on the flags rather than the page
 * text so re-scanning a surface that ships a nonce or timestamp in its HTML
 * yields the same score, and so the digest is evenly distributed.
 */
function signalHash(s: DocSignals): number {
  const key = [
    s.reachable,
    s.hasLlmsTxt,
    s.hasOpenApiMention,
    s.hasMcpMention,
    s.hasCliMention,
    s.hasAuthDocs,
    s.hasApiKeyAuth,
    s.hasOauth,
    s.hasErrorDocs,
    s.hasCodeSamples,
    s.hasQuickstart,
  ]
    .map((b) => (b ? "1" : "0"))
    .join("");
  let h = 0x811c9dc5;
  for (let i = 0; i < key.length; i++) {
    h ^= key.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  return h;
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
 * The step where an agent typically dies on this surface.
 *
 * Attribution is a property of the docs, not of the agent — per-agent capability
 * is modelled once, in `agentBias`. Keeping a second agent axis here contradicted
 * that ordering (it made cursor-agent score below codex).
 */
export function attributeFailStep(signals: DocSignals): FailStep {
  if (!signals.reachable) return "discovery";
  if (!signals.hasQuickstart && !signals.hasCodeSamples) return "docs";
  if (!signals.hasAuthDocs) return "auth";
  if (signals.hasOauth && !signals.hasApiKeyAuth) return "auth";
  if (!signals.hasOpenApiMention && !signals.hasMcpMention && !signals.hasCliMention) {
    return "tool-selection";
  }
  if (!signals.hasErrorDocs) return "error-recovery";
  if (!signals.hasMcpMention && !signals.hasCliMention) return "api-call";
  return "none";
}

function simulateOneRun(
  agent: AgentName,
  signals: DocSignals,
  jtbdPrompt: string,
  baseScore: number,
): AgentRun {
  const failStep = attributeFailStep(signals);
  // Agents with stronger MCP/CLI tool use clear the bar more often.
  const agentBias: Record<AgentName, number> = {
    "claude-code": 0.05,
    "cursor-agent": 0,
    codex: -0.05,
  };
  // No reachability check needed: attributeFailStep returns "discovery" when
  // the docs are unreachable, so failStep === "none" already implies it.
  const successProb = clamp(baseScore / 10 + agentBias[agent] + BASE_SUCCESS_BONUS, 0.05, 0.95);
  const hash = signalHash(signals);
  // One roll per surface, shared by all agents, so a higher-bias agent always
  // succeeds wherever a lower-bias one does.
  const roll = (hash % 1000) / 1000;
  const actuallySucceeds = failStep === "none" && roll < successProb;
  const step: FailStep = actuallySucceeds
    ? "none"
    : failStep === "none"
      ? "api-call"
      : failStep;

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
    durationMs: 8000 + ((hash + AGENT_SALT[agent]) % 12000),
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

/** Cap on fixes shown, including the always-present agent-skill wedge. */
const MAX_FIXES = 6;

export function rankedFixes(signals: DocSignals): RankedFix[] {
  const fixes: Omit<RankedFix, "priority">[] = [];
  const push = (title: string, detail: string) => {
    fixes.push({ title, detail });
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

  // The agent-skill wedge always ships. Its slot is reserved before the cap:
  // appending then slicing dropped it on exactly the surfaces that need it most,
  // where all seven conditional fixes already fill the list.
  const ranked = [
    ...fixes.slice(0, MAX_FIXES - 1),
    {
      title: "Publish an official agent skill",
      detail:
        "A tested SKILL.md with auth, endpoints, and gotchas is how agents keep choosing you. FirstSkill packs this.",
    },
  ];

  return ranked.map((fix, i) => ({ priority: i + 1, ...fix }));
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
