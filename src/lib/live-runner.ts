import type { AgentName, AgentRun, FailStep } from "./types";
import { attributeFailStep, type DocSignals } from "./scorer";
import { safeFetch } from "./safe-fetch";

export interface ProbeResult {
  url: string;
  ok: boolean;
  status: number;
  latencyMs: number;
  contentType: string;
  hasPayload: boolean;
}

/** Assertions that must pass for the surface to count as agent-ready. */
const LIVE_PASS_THRESHOLD = 4;
const TOTAL_ASSERTIONS = 5;

async function probeEndpoint(url: string, timeoutMs = 7000): Promise<ProbeResult> {
  const start = performance.now();
  try {
    const res = await safeFetch(url, {
      headers: {
        "User-Agent": "FirstSkill-DocsProbe/1.0 (+https://firstskill.dev)",
        Accept: "application/json, text/plain, text/markdown, text/html, */*",
      },
      timeoutMs,
    });

    return {
      url,
      ok: res.ok,
      status: res.status,
      latencyMs: Math.round(performance.now() - start),
      contentType: res.contentType,
      hasPayload: res.text.length > 50,
    };
  } catch {
    return {
      url,
      ok: false,
      status: 0,
      latencyMs: Math.round(performance.now() - start),
      contentType: "",
      hasPayload: false,
    };
  }
}

/** Reuses the fetch analyzeDocs already performed instead of hitting the docs again. */
function docsProbeFromSignals(signals: DocSignals, docsUrl: string): ProbeResult {
  return {
    url: docsUrl,
    ok: signals.reachable,
    status: signals.status ?? 0,
    latencyMs: signals.latencyMs ?? 0,
    contentType: "",
    hasPayload: signals.bodySnippet.length > 50,
  };
}

/**
 * Scores one agent profile against the shared probe results.
 *
 * Two of the five assertions are live HTTP checks (`probe:`); the other three
 * are re-reads of signals already parsed out of the docs (`signal:`). The
 * transcript prefixes keep that distinction visible — no agent is executed here.
 */
export function evaluateAgentProfile(
  agent: AgentName,
  signals: DocSignals,
  jtbdPrompt: string,
  docsProbe: ProbeResult,
  indexProbe: ProbeResult | null,
): AgentRun {
  const startTime = performance.now();
  const transcript: string[] = [];
  let passedAssertions = 0;

  const nowStamp = () => new Date().toISOString().split("T")[1].slice(0, 8);
  const log = (line: string) => transcript.push(`[${nowStamp()}] [${agent}] ${line}`);

  log("Docs probe started — live HTTP checks against published surfaces");
  log(`Target JTBD: "${jtbdPrompt.slice(0, 100)}…"`);

  // Assertion 1 (live): base docs reachability
  if (docsProbe.ok) {
    passedAssertions++;
    log(`PASS [probe:docs] ${docsProbe.url} -> HTTP ${docsProbe.status} (${docsProbe.latencyMs}ms)`);
  } else {
    log(`FAIL [probe:docs] ${docsProbe.url} -> HTTP ${docsProbe.status || "ERR"} (${docsProbe.latencyMs}ms)`);
  }

  // Assertion 2 (live): machine-readable index (/llms.txt or OpenAPI)
  if (indexProbe && indexProbe.ok && indexProbe.hasPayload) {
    passedAssertions++;
    log(`PASS [probe:schema] Machine index located at ${indexProbe.url} (${indexProbe.latencyMs}ms)`);
  } else {
    log("WARN [probe:schema] No explicit llms.txt or openapi found; crawling unstructured HTML");
  }

  // Assertion 3 (parsed): auth contract
  if (signals.hasApiKeyAuth || (signals.hasAuthDocs && !signals.hasOauth)) {
    passedAssertions++;
    log("PASS [signal:auth] Direct API key authorization contract documented");
  } else if (signals.hasOauth && !signals.hasApiKeyAuth) {
    log("FAIL [signal:auth] Interactive OAuth barrier documented without an unattended service token");
  } else {
    log("WARN [signal:auth] Ambiguous auth headers in parsed documentation");
  }

  // Assertion 4 (parsed): callable tool surface
  if (signals.hasMcpMention || signals.hasCliMention || signals.hasOpenApiMention) {
    passedAssertions++;
    log("PASS [signal:tools] Callable API tools & parameter contracts documented");
  } else {
    log("FAIL [signal:tools] No structured schema documented; agent must guess endpoint signatures");
  }

  // Assertion 5 (parsed): error schema
  if (signals.hasErrorDocs) {
    passedAssertions++;
    log("PASS [signal:errors] Structured error remediation documented");
  } else {
    log("WARN [signal:errors] No machine-readable error recovery schema documented");
  }

  const failStep = attributeFailStep(signals);
  const durationMs = Math.round(performance.now() - startTime);
  const isSuccess = passedAssertions >= LIVE_PASS_THRESHOLD && failStep === "none";
  const finalFailStep: FailStep = isSuccess
    ? "none"
    : failStep === "none"
      ? "api-call"
      : failStep;

  log(
    isSuccess
      ? `SUCCESS — Probe verified ${passedAssertions}/${TOTAL_ASSERTIONS} assertions in ${durationMs}ms`
      : `FAIL @ ${finalFailStep} — Probe blocked (${passedAssertions}/${TOTAL_ASSERTIONS} passed)`,
  );

  return {
    agent,
    success: isSuccess,
    failStep: finalFailStep,
    durationMs,
    transcript,
    notes: isSuccess
      ? `Live probe passed ${passedAssertions}/${TOTAL_ASSERTIONS} assertions (2 HTTP, 3 parsed).`
      : `Live probe blocked at ${finalFailStep} (${passedAssertions}/${TOTAL_ASSERTIONS} passed).`,
    runnerMode: "live",
    liveMetrics: {
      httpStatus: docsProbe.status,
      latencyMs: docsProbe.latencyMs,
      reachable: docsProbe.ok,
      probePath: docsProbe.url,
      passedAssertions,
      totalAssertions: TOTAL_ASSERTIONS,
      endpointProbed: indexProbe?.url ?? docsProbe.url,
    },
  };
}

/**
 * Probes the surface once, then scores each agent profile against those results.
 * Probing per agent issued the same requests three times over and let the three
 * runs report different latencies for one target.
 */
export async function runLiveAgentEvaluation(
  signals: DocSignals,
  jtbdPrompt: string,
  docsUrl: string,
  openApiUrl?: string,
): Promise<AgentRun[]> {
  const docsProbe = docsProbeFromSignals(signals, docsUrl);

  let indexProbe: ProbeResult | null = null;
  if (openApiUrl) {
    indexProbe = await probeEndpoint(openApiUrl, 6000);
  } else {
    try {
      const { origin } = new URL(docsUrl);
      indexProbe = await probeEndpoint(`${origin}/llms.txt`, 4000);
    } catch {
      indexProbe = null;
    }
  }

  const agents: AgentName[] = ["claude-code", "cursor-agent", "codex"];
  return agents.map((agent) =>
    evaluateAgentProfile(agent, signals, jtbdPrompt, docsProbe, indexProbe),
  );
}
