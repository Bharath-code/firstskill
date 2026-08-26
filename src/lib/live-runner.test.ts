import assert from "node:assert/strict";
import { test } from "node:test";
import { evaluateAgentProfile, type ProbeResult } from "./live-runner";
import type { DocSignals } from "./scorer";
import type { AgentName } from "./types";

// Run: npm test
const AGENTS: AgentName[] = ["claude-code", "cursor-agent", "codex"];

function signals(over: Partial<DocSignals> = {}): DocSignals {
  return {
    reachable: true,
    hasLlmsTxt: true,
    hasOpenApiMention: true,
    hasMcpMention: true,
    hasCliMention: true,
    hasAuthDocs: true,
    hasApiKeyAuth: true,
    hasOauth: false,
    hasErrorDocs: true,
    hasCodeSamples: true,
    hasQuickstart: true,
    bodySnippet: "a".repeat(200),
    status: 200,
    latencyMs: 123,
    ...over,
  };
}

const probe = (over: Partial<ProbeResult> = {}): ProbeResult => ({
  url: "https://example.com/docs",
  ok: true,
  status: 200,
  latencyMs: 123,
  contentType: "text/html",
  hasPayload: true,
  ...over,
});

test("every agent reports the same probe metrics for one target", () => {
  const docs = probe();
  const index = probe({ url: "https://example.com/llms.txt", latencyMs: 45 });
  const metrics = AGENTS.map(
    (a) => evaluateAgentProfile(a, signals(), "job", docs, index).liveMetrics,
  );
  for (const m of metrics.slice(1)) {
    assert.deepEqual(m, metrics[0]);
  }
  assert.equal(metrics[0]!.latencyMs, 123);
  assert.equal(metrics[0]!.reachable, true);
});

test("a failed docs probe is not reported as reachable", () => {
  const run = evaluateAgentProfile(
    "claude-code",
    signals({ reachable: false }),
    "job",
    probe({ ok: false, status: 0 }),
    null,
  );
  assert.equal(run.liveMetrics!.reachable, false);
  assert.equal(run.success, false);
  assert.equal(run.failStep, "discovery");
});

test("transcript distinguishes live HTTP probes from parsed signals", () => {
  const run = evaluateAgentProfile("claude-code", signals(), "job", probe(), probe());
  const lines = run.transcript.join("\n");
  assert.equal((lines.match(/\[probe:/g) ?? []).length, 2, "exactly 2 live HTTP checks");
  assert.equal((lines.match(/\[signal:/g) ?? []).length, 3, "exactly 3 parsed signals");
});

test("success requires clearing the assertion threshold and every fail step", () => {
  const ok = evaluateAgentProfile("claude-code", signals(), "job", probe(), probe());
  assert.equal(ok.success, true);
  assert.equal(ok.liveMetrics!.passedAssertions, 5);

  const weak = evaluateAgentProfile(
    "claude-code",
    signals({ hasErrorDocs: false }),
    "job",
    probe(),
    probe(),
  );
  assert.equal(weak.success, false);
  assert.equal(weak.failStep, "error-recovery");
});
