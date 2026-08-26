import assert from "node:assert/strict";
import { test } from "node:test";
import {
  simulateRuns,
  attributeFailStep,
  detectSignals,
  rankedFixes,
  computeScore,
  type DocSignals,
} from "./scorer";

// Run: npm test
/**
 * Base fixture scores 7.0 and attributes failStep "none" — the band where the
 * per-agent bias actually discriminates. All-true signals clamp to 10 and make
 * every agent succeed unconditionally, which hides ordering bugs.
 */
function signals(over: Partial<DocSignals> = {}): DocSignals {
  return {
    reachable: true,
    hasLlmsTxt: false,
    hasOpenApiMention: false,
    hasMcpMention: true,
    hasCliMention: false,
    hasAuthDocs: true,
    hasApiKeyAuth: true,
    hasOauth: false,
    hasErrorDocs: true,
    hasCodeSamples: true,
    hasQuickstart: true,
    bodySnippet: "docs",
    ...over,
  };
}

/** Every distinct combination of the 11 boolean signal flags. */
function allSignalCombos(): DocSignals[] {
  const keys = [
    "reachable", "hasLlmsTxt", "hasOpenApiMention", "hasMcpMention",
    "hasCliMention", "hasAuthDocs", "hasApiKeyAuth", "hasOauth",
    "hasErrorDocs", "hasCodeSamples", "hasQuickstart",
  ] as const;
  const out: DocSignals[] = [];
  for (let mask = 0; mask < 1 << keys.length; mask++) {
    const over: Partial<DocSignals> = {};
    keys.forEach((k, i) => {
      over[k] = Boolean(mask & (1 << i));
    });
    out.push(signals(over));
  }
  return out;
}

test("agent bias orders success: claude-code succeeds wherever codex does", () => {
  let discriminated = 0;
  for (const s of allSignalCombos()) {
    const byAgent = new Map(simulateRuns(s, "job").map((r) => [r.agent, r.success]));
    const claude = byAgent.get("claude-code")!;
    const cursor = byAgent.get("cursor-agent")!;
    const codex = byAgent.get("codex")!;
    assert.ok(claude >= cursor, `claude-code must not trail cursor-agent`);
    assert.ok(cursor >= codex, `cursor-agent must not trail codex`);
    if (claude !== codex) discriminated++;
  }
  assert.ok(discriminated > 0, "bias must change the outcome for at least one surface");
});

test("score is stable when only volatile page text changes", () => {
  const a = simulateRuns(signals({ bodySnippet: "<meta nonce=abc123>" }), "job");
  const b = simulateRuns(signals({ bodySnippet: "<meta nonce=zzz999>" }), "job");
  assert.deepEqual(
    a.map((r) => [r.agent, r.success, r.failStep, r.durationMs]),
    b.map((r) => [r.agent, r.success, r.failStep, r.durationMs]),
  );
});

test("each agent gets a distinct simulated duration", () => {
  const ms = simulateRuns(signals(), "job").map((r) => r.durationMs);
  assert.equal(new Set(ms).size, 3);
});

test("a failed step always means success=false", () => {
  for (const r of simulateRuns(signals({ reachable: false }), "job")) {
    assert.equal(r.success, false);
    assert.equal(r.failStep, "discovery");
  }
});

test("success implies failStep none, and vice versa", () => {
  for (let i = 0; i < 200; i++) {
    for (const r of simulateRuns(signals({ bodySnippet: `x${i}` }), "job")) {
      assert.equal(r.success, r.failStep === "none");
    }
  }
});

test("unreachable docs fail at discovery", () => {
  assert.equal(attributeFailStep(signals({ reachable: false })), "discovery");
});

test("missing error docs fail at error-recovery for every agent, not just one", () => {
  const s = signals({ hasErrorDocs: false });
  assert.equal(attributeFailStep(s), "error-recovery");
  for (const r of simulateRuns(s, "job")) assert.equal(r.failStep, "error-recovery");
});

test("oauth-only surfaces fail at auth", () => {
  const s = signals({ hasOauth: true, hasApiKeyAuth: false });
  assert.equal(attributeFailStep(s), "auth");
});

// --- signal detection: regressions for the raw-HTML false positives ---

const MARKETING_PAGE = `
<html><head>
  <meta name="author" content="Acme Docs Team">
  <link rel="stylesheet" href="/app.css">
  <style>.hero { width: 400px; max-width: 4096px; }</style>
  <script>const tokens = {"theme.json": 1}; fetch("/api/ping");</script>
</head><body>
  <h1>Acme</h1>
  <p>The platform for teams. Plans from $499.</p>
</body></html>`;

test("a marketing page with no docs lights up no signals", () => {
  const s = detectSignals(MARKETING_PAGE);
  assert.deepEqual(s, {
    hasOpenApiMention: false,
    hasMcpMention: false,
    hasCliMention: false,
    hasAuthDocs: false,
    hasApiKeyAuth: false,
    hasOauth: false,
    hasErrorDocs: false,
    hasCodeSamples: false,
    hasQuickstart: false,
  });
});

test("<meta name=author> is not auth documentation", () => {
  assert.equal(detectSignals(`<meta name="author" content="Jo">`).hasAuthDocs, false);
  assert.equal(detectSignals(`<p>Written by the author.</p>`).hasAuthDocs, false);
  assert.equal(detectSignals(`<p>Send your API key in the Authorization header.</p>`).hasAuthDocs, true);
});

test("CSS pixel values and prices are not HTTP status codes", () => {
  assert.equal(detectSignals(`<style>.a{width:400px}</style>`).hasErrorDocs, false);
  assert.equal(detectSignals(`<p>Only $499, or 4096 credits.</p>`).hasErrorDocs, false);
  assert.equal(detectSignals(`<p>A 404 means the record is missing.</p>`).hasErrorDocs, true);
});

test("openapi detection is not a greedy .json/api match", () => {
  assert.equal(detectSignals(`<p>Edit theme.json then open the api page.</p>`).hasOpenApiMention, false);
  assert.equal(detectSignals(`<p>Download our OpenAPI spec.</p>`).hasOpenApiMention, true);
});

test("an explicit openApiUrl still forces the openapi signal", () => {
  assert.equal(detectSignals(MARKETING_PAGE, true).hasOpenApiMention, true);
});

test("code samples are detected from markup, not backticks in HTML", () => {
  assert.equal(detectSignals(`<pre><code>curl -X POST</code></pre>`).hasCodeSamples, true);
  assert.equal(detectSignals(`<p>We have great docs.</p>`).hasCodeSamples, false);
});

test("a real API docs page lights up the expected signals", () => {
  const s = detectSignals(`
    <h1>Quickstart</h1>
    <p>Get running in 5 minutes. Authenticate with an API key via the CLI.</p>
    <pre><code>npx acme login</code></pre>
    <p>Errors return a status code such as 429; retry with backoff.</p>
    <p>Full OpenAPI spec and MCP server available.</p>`);
  assert.deepEqual(s, {
    hasOpenApiMention: true,
    hasMcpMention: true,
    hasCliMention: true,
    hasAuthDocs: true,
    hasApiKeyAuth: true,
    hasOauth: false,
    hasErrorDocs: true,
    hasCodeSamples: true,
    hasQuickstart: true,
  });
});

// --- ranked fixes ---

const WEDGE = "Publish an official agent skill";
const worst = signals({
  reachable: false, hasLlmsTxt: false, hasOpenApiMention: false, hasMcpMention: false,
  hasCliMention: false, hasAuthDocs: false, hasApiKeyAuth: false, hasOauth: false,
  hasErrorDocs: false, hasCodeSamples: false, hasQuickstart: false,
});

test("the agent-skill wedge survives even when every other fix applies", () => {
  const fixes = rankedFixes(worst);
  assert.ok(
    fixes.some((f) => f.title === WEDGE),
    `wedge dropped from: ${fixes.map((f) => f.title).join(", ")}`,
  );
});

test("fixes are capped at 6 and numbered 1..n with no gaps", () => {
  for (const s of [worst, signals(), signals({ hasLlmsTxt: false })]) {
    const fixes = rankedFixes(s);
    assert.ok(fixes.length > 0 && fixes.length <= 6, `got ${fixes.length}`);
    assert.deepEqual(
      fixes.map((f) => f.priority),
      fixes.map((_, i) => i + 1),
    );
  }
});

/** Every signal present: nothing left to fix but the wedge. */
const healthy = signals({
  hasLlmsTxt: true, hasOpenApiMention: true, hasCliMention: true, hasCodeSamples: true,
});

test("a fully healthy surface gets the wedge and nothing else", () => {
  const fixes = rankedFixes(healthy);
  assert.deepEqual(fixes.map((f) => f.title), [WEDGE]);
});

test("fixes address the signals that are actually missing", () => {
  const s = signals({ hasLlmsTxt: false, hasOauth: true, hasApiKeyAuth: false });
  const titles = rankedFixes(s).map((f) => f.title);
  assert.ok(titles.includes("Ship /llms.txt"));
  assert.ok(titles.includes("Add an API-key path for agents"));
});

// --- computeScore ---

test("unreachable docs score near zero; a full surface scores near ten", () => {
  const bad = computeScore(simulateRuns(worst, "job"), worst);
  assert.equal(bad.successRate, 0);
  assert.ok(bad.score < 1, `got ${bad.score}`);

  const hi = computeScore(simulateRuns(healthy, "job"), healthy);
  assert.equal(hi.successRate, 1);
  assert.ok(hi.score > 9, `got ${hi.score}`);
});

test("score stays inside 0..10 across every signal combination", () => {
  for (const s of allSignalCombos()) {
    const { score, successRate } = computeScore(simulateRuns(s, "job"), s);
    assert.ok(score >= 0 && score <= 10, `score ${score} out of range`);
    assert.ok(successRate >= 0 && successRate <= 1, `rate ${successRate} out of range`);
  }
});
