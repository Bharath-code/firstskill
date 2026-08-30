import Anthropic from "@anthropic-ai/sdk";
import type { AgentRun, FailStep } from "./types";
import { safeFetch, BlockedUrlError } from "./safe-fetch";

/**
 * The only runner that actually executes an agent.
 *
 * `live-runner.ts` probes URLs and re-reads doc signals — useful, but it is not
 * an agent attempting the job. This drives a real Claude tool loop against the
 * product's public surface and keeps the verbatim transcript, because "an agent
 * tried and got this far" is the only claim worth selling.
 */

const MODEL = "claude-opus-5";
const MAX_TURNS = 10;
const MAX_HTTP_CALLS = 12;
const RESULT_BODY_CHARS = 3000;

export class NoAgentCredentialsError extends Error {}

const FAIL_STEPS: FailStep[] = [
  "discovery",
  "docs",
  "auth",
  "tool-selection",
  "api-call",
  "error-recovery",
  "none",
];

const httpTool: Anthropic.Tool = {
  name: "http_request",
  description:
    "Make one HTTP request to a public URL. Use it to read docs and to call the product's API. " +
    "You have no credentials for this product — if a call needs auth, try it anyway and report what happens.",
  input_schema: {
    type: "object",
    properties: {
      method: { type: "string", enum: ["GET", "POST", "PUT", "PATCH", "DELETE"] },
      url: { type: "string" },
      headers: { type: "object", additionalProperties: { type: "string" } },
      body: { type: "string", description: "Raw request body (JSON string for JSON APIs)." },
    },
    required: ["method", "url"],
    additionalProperties: false,
  },
};

const reportTool: Anthropic.Tool = {
  name: "report_result",
  description: "Call exactly once, at the end, to report whether you completed the job.",
  input_schema: {
    type: "object",
    properties: {
      success: { type: "boolean", description: "True only if you actually completed the job end to end." },
      failStep: {
        type: "string",
        enum: FAIL_STEPS,
        description:
          "Where you got stuck: discovery (couldn't find the API), docs (docs unusable), " +
          "auth (couldn't get or use a key), tool-selection (unclear which endpoint), " +
          "api-call (call rejected), error-recovery (error was unrecoverable), none (succeeded).",
      },
      summary: { type: "string", description: "One or two sentences a developer can act on." },
    },
    required: ["success", "failStep", "summary"],
    additionalProperties: false,
  },
};

interface Verdict {
  success: boolean;
  failStep: FailStep;
  summary: string;
}

/** Narrows model-supplied JSON. A malformed report is a failed run, not a crash. */
export function parseVerdict(input: unknown): Verdict {
  const raw = (input ?? {}) as Record<string, unknown>;
  const failStep = FAIL_STEPS.includes(raw.failStep as FailStep)
    ? (raw.failStep as FailStep)
    : "api-call";
  const success = raw.success === true && failStep === "none";
  return {
    success,
    failStep: success ? "none" : failStep === "none" ? "api-call" : failStep,
    summary: typeof raw.summary === "string" ? raw.summary.slice(0, 500) : "No summary reported.",
  };
}

function systemPrompt(
  jtbd: string,
  docsUrl: string,
  openApiUrl?: string,
  skillMd?: string,
): string {
  return `You are an autonomous coding agent evaluating whether a product's public API is usable by agents.

Job to be done: ${jtbd}
Docs: ${docsUrl}${openApiUrl ? `\nOpenAPI: ${openApiUrl}` : ""}

Rules:
- You have NO API key and cannot sign up or click a UI. Work only with public HTTP.
- Read the docs first, then attempt the real API calls the job needs.
- Do not pretend a step succeeded. An unauthenticated 401 on the correct endpoint is a
  useful result: it means discovery and endpoint selection worked and auth is the wall.
- You have at most ${MAX_HTTP_CALLS} HTTP requests. Spend them deliberately.
- Finish by calling report_result exactly once.
${skillMd ? `\nAn official agent skill for this product is installed. Follow it:\n\n${skillMd}` : ""}`;
}

/**
 * Runs one real agent attempt. Throws NoAgentCredentialsError when no key is
 * configured — callers must fall back and relabel, never claim a run happened.
 */
export async function runAgentEvaluation(
  jtbd: string,
  docsUrl: string,
  openApiUrl?: string,
  skillMd?: string,
): Promise<AgentRun> {
  if (!process.env.ANTHROPIC_API_KEY) {
    throw new NoAgentCredentialsError("ANTHROPIC_API_KEY is not set");
  }

  const client = new Anthropic();
  const startTime = performance.now();
  const transcript: string[] = [];
  const stamp = () => new Date().toISOString().split("T")[1].slice(0, 8);
  const log = (line: string) => transcript.push(`[${stamp()}] [claude-code] ${line}`);

  const messages: Anthropic.MessageParam[] = [
    { role: "user", content: `Attempt the job now. Start by reading ${docsUrl}.` },
  ];

  let httpCalls = 0;
  let lastStatus: number | undefined;
  let lastUrl: string | undefined;
  let verdict: Verdict | null = null;

  log(`START — ${jtbd}${skillMd ? " (with skill pack installed)" : ""}`);

  for (let turn = 0; turn < MAX_TURNS && !verdict; turn++) {
    const response = await client.messages.create({
      model: MODEL,
      max_tokens: 16000,
      system: systemPrompt(jtbd, docsUrl, openApiUrl, skillMd),
      tools: [httpTool, reportTool],
      messages,
    });

    messages.push({ role: "assistant", content: response.content });
    const results: Anthropic.ToolResultBlockParam[] = [];

    for (const block of response.content) {
      if (block.type === "text" && block.text.trim()) {
        log(`THINK ${block.text.trim().replace(/\s+/g, " ").slice(0, 300)}`);
        continue;
      }
      if (block.type !== "tool_use") continue;

      if (block.name === "report_result") {
        verdict = parseVerdict(block.input);
        break;
      }

      const args = block.input as { method: string; url: string; headers?: Record<string, string>; body?: string };
      if (httpCalls >= MAX_HTTP_CALLS) {
        log(`BLOCKED request budget exhausted (${MAX_HTTP_CALLS})`);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          is_error: true,
          content: "Request budget exhausted. Call report_result now.",
        });
        continue;
      }

      httpCalls++;
      log(`CALL ${args.method} ${args.url}`);
      try {
        const res = await safeFetch(args.url, {
          method: args.method,
          headers: { "User-Agent": "FirstSkill-Agent/1.0 (+https://firstskill.dev)", ...args.headers },
          body: args.method === "GET" ? undefined : args.body,
          timeoutMs: 10000,
        });
        lastStatus = res.status;
        lastUrl = res.url;
        log(`RESP ${res.status} ${res.contentType.split(";")[0]} ${res.text.length}b`);
        results.push({
          type: "tool_result",
          tool_use_id: block.id,
          content: `HTTP ${res.status}\ncontent-type: ${res.contentType}\n\n${res.text.slice(0, RESULT_BODY_CHARS)}`,
        });
      } catch (e) {
        const reason = e instanceof BlockedUrlError ? e.message : "request failed";
        log(`ERROR ${reason}`);
        results.push({ type: "tool_result", tool_use_id: block.id, is_error: true, content: reason });
      }
    }

    if (verdict) break;
    if (!results.length) {
      log("STOP — agent stopped without reporting a result");
      break;
    }
    messages.push({ role: "user", content: results });
  }

  const durationMs = Math.round(performance.now() - startTime);
  const final: Verdict = verdict ?? {
    success: false,
    failStep: "error-recovery",
    summary: `Agent ran out of turns after ${httpCalls} requests without completing the job.`,
  };

  log(
    final.success
      ? `SUCCESS — job completed in ${httpCalls} requests / ${durationMs}ms`
      : `FAIL @ ${final.failStep} — ${final.summary}`,
  );

  return {
    agent: "claude-code",
    success: final.success,
    failStep: final.failStep,
    durationMs,
    transcript,
    notes: final.summary,
    runnerMode: "agent",
    liveMetrics: {
      httpStatus: lastStatus,
      latencyMs: durationMs,
      reachable: httpCalls > 0,
      probePath: lastUrl,
      passedAssertions: final.success ? 1 : 0,
      totalAssertions: 1,
      endpointProbed: lastUrl,
    },
  };
}
