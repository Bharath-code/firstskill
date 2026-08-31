import { test } from "node:test";
import assert from "node:assert/strict";
import { buildRegressionAlert } from "./alert";
import type { Scorecard } from "./types";

const card: Scorecard = {
  id: "score_1", slug: "acme-1", productName: "Acme", docsUrl: "https://acme.dev/docs",
  niche: "retrieval", jtbd: "search and fetch", jtbdId: "retrieval-search-fetch",
  score: 5.1, successRate: 0, fixes: [], public: true, seeded: false,
  createdAt: "2026-01-01T00:00:00.000Z", runnerMode: "agent",
  runs: [
    { agent: "claude-code", success: false, failStep: "auth", durationMs: 900,
      transcript: [], notes: "" },
  ],
};

test("alert reconstructs the previous score from the delta", () => {
  const a = buildRegressionAlert(card, -1.4, "2026-03-01T00:00:00.000Z", "https://firstskill.dev");
  assert.equal(a.previousScore, 6.5);
  assert.equal(a.newScore, 5.1);
  assert.equal(a.delta, -1.4);
});

test("alert names the failing step and links the report", () => {
  const a = buildRegressionAlert(card, -1.4, "2026-03-01T00:00:00.000Z", "https://firstskill.dev");
  assert.equal(a.failStep, "auth");
  assert.equal(a.reportUrl, "https://firstskill.dev/score/acme-1");
  assert.match(a.text, /Acme/);
  assert.match(a.text, /1\.4 pts/);
  assert.match(a.text, /6\.5 → 5\.1/);
  assert.equal(a.content, a.text);
});

test("fail step is none when every run passed", () => {
  const passing: Scorecard = {
    ...card,
    runs: [{ agent: "claude-code", success: true, failStep: "none", durationMs: 900,
             transcript: [], notes: "" }],
  };
  assert.equal(
    buildRegressionAlert(passing, -1.2, "2026-03-01T00:00:00.000Z", "https://x.dev").failStep,
    "none",
  );
});
