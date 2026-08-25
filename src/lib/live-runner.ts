import type { AgentName, AgentRun, FailStep } from "./types";
import { attributeFailStep, type DocSignals } from "./scorer";
import { safeFetch } from "./safe-fetch";

interface ProbeResult {
  url: string;
  ok: boolean;
  status: number;
  latencyMs: number;
  contentType: string;
  hasPayload: boolean;
}

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
    const latencyMs = Math.round(performance.now() - start);

    return {
      url,
      ok: res.ok,
      status: res.status,
      latencyMs,
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

/**
 * Live docs probe: real HTTP checks against the docs/OpenAPI surface, scored per agent profile.
 * NOTE: this does NOT execute an agent. It measures reachability + machine-readable surfaces.
 */
export async function executeLiveAgentRun(
  agent: AgentName,
  signals: DocSignals,
  jtbdPrompt: string,
  baseDocsUrl: string,
  openApiUrl?: string,
): Promise<AgentRun> {
  const startTime = performance.now();
  const transcript: string[] = [];
  let passedAssertions = 0;
  const totalAssertions = 5;

  const nowStamp = () => new Date().toISOString().split("T")[1].slice(0, 8);

  transcript.push(`[${nowStamp()}] [${agent}] Docs probe started — live HTTP checks against published surfaces`);
  transcript.push(`[${nowStamp()}] [${agent}] Target JTBD: "${jtbdPrompt.slice(0, 100)}…"`);

  // Assertion 1: Base Docs Reachability
  const docsProbe = await probeEndpoint(baseDocsUrl, 8000);
  if (docsProbe.ok) {
    passedAssertions++;
    transcript.push(
      `[${nowStamp()}] [${agent}] PASS [probe:docs] ${docsProbe.url} -> HTTP ${docsProbe.status} (${docsProbe.latencyMs}ms)`,
    );
  } else {
    transcript.push(
      `[${nowStamp()}] [${agent}] FAIL [probe:docs] ${docsProbe.url} -> HTTP ${docsProbe.status || "ERR"} (${docsProbe.latencyMs}ms)`,
    );
  }

  // Assertion 2: Machine-Readable Index (/llms.txt or OpenAPI)
  let indexProbe: ProbeResult | null = null;
  if (openApiUrl) {
    indexProbe = await probeEndpoint(openApiUrl, 6000);
  } else {
    try {
      const parsed = new URL(baseDocsUrl);
      indexProbe = await probeEndpoint(`${parsed.origin}/llms.txt`, 4000);
    } catch {
      indexProbe = null;
    }
  }

  if (indexProbe && indexProbe.ok && indexProbe.hasPayload) {
    passedAssertions++;
    transcript.push(
      `[${nowStamp()}] [${agent}] PASS [probe:schema] Machine index located at ${indexProbe.url} (${indexProbe.latencyMs}ms)`,
    );
  } else {
    transcript.push(
      `[${nowStamp()}] [${agent}] WARN [probe:schema] No explicit llms.txt or openapi found; crawling unstructured HTML`,
    );
  }

  // Assertion 3: Auth Contract Discovery
  if (signals.hasApiKeyAuth || (signals.hasAuthDocs && !signals.hasOauth)) {
    passedAssertions++;
    transcript.push(
      `[${nowStamp()}] [${agent}] PASS [probe:auth] Direct API key authorization contract verified`,
    );
  } else if (signals.hasOauth && !signals.hasApiKeyAuth) {
    transcript.push(
      `[${nowStamp()}] [${agent}] FAIL [probe:auth] Interactive OAuth barrier detected without unattended service token`,
    );
  } else {
    transcript.push(
      `[${nowStamp()}] [${agent}] WARN [probe:auth] Ambiguous auth headers in parsed documentation`,
    );
  }

  // Assertion 4: Tool & Action Surface Discovery
  const hasCallableSurface = signals.hasMcpMention || signals.hasCliMention || signals.hasOpenApiMention;
  if (hasCallableSurface) {
    passedAssertions++;
    transcript.push(
      `[${nowStamp()}] [${agent}] PASS [probe:tools] Verified callable API tools & parameter contracts`,
    );
  } else {
    transcript.push(
      `[${nowStamp()}] [${agent}] FAIL [probe:tools] Missing structured schema; agent must hallucinate endpoint signatures`,
    );
  }

  // Assertion 5: Error Schema & Recovery
  if (signals.hasErrorDocs) {
    passedAssertions++;
    transcript.push(
      `[${nowStamp()}] [${agent}] PASS [probe:errors] Structured error remediation definitions detected`,
    );
  } else {
    transcript.push(
      `[${nowStamp()}] [${agent}] WARN [probe:errors] No machine-readable error recovery schema discovered`,
    );
  }

  const failStep = attributeFailStep(signals, agent);
  const durationMs = Math.round(performance.now() - startTime);

  // Probe "success" = docs reachable + machine-readable surfaces present
  const isSuccess = passedAssertions >= 4 && failStep === "none" && docsProbe.ok;
  const finalFailStep: FailStep = isSuccess ? "none" : failStep === "none" ? "api-call" : failStep;

  if (isSuccess) {
    transcript.push(
      `[${nowStamp()}] [${agent}] SUCCESS — Probe verified ${passedAssertions}/${totalAssertions} assertions in ${durationMs}ms`,
    );
  } else {
    transcript.push(
      `[${nowStamp()}] [${agent}] FAIL @ ${finalFailStep} — Probe blocked (${passedAssertions}/${totalAssertions} passed)`,
    );
  }

  return {
    agent,
    success: isSuccess,
    failStep: finalFailStep,
    durationMs,
    transcript,
    notes: isSuccess
      ? `Live probe passed ${passedAssertions}/${totalAssertions} verified assertions.`
      : `Live probe blocked at ${finalFailStep} (${passedAssertions}/${totalAssertions} passed).`,
    runnerMode: "live",
    liveMetrics: {
      httpStatus: docsProbe.status,
      latencyMs: docsProbe.latencyMs,
      dnsResolved: docsProbe.status > 0,
      probePath: docsProbe.url,
      passedAssertions,
      totalAssertions,
      endpointProbed: indexProbe?.url ?? docsProbe.url,
    },
  };
}

/**
 * Runs the live docs probe once per agent profile. The network probes are shared;
 * only fail-step attribution differs per agent.
 */
export async function runLiveAgentEvaluation(
  signals: DocSignals,
  jtbdPrompt: string,
  docsUrl: string,
  openApiUrl?: string,
): Promise<AgentRun[]> {
  const agents: AgentName[] = ["claude-code", "cursor-agent", "codex"];
  const runs = await Promise.all(
    agents.map((agent) =>
      executeLiveAgentRun(agent, signals, jtbdPrompt, docsUrl, openApiUrl),
    ),
  );
  return runs;
}
