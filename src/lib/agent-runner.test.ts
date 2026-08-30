import { test } from "node:test";
import assert from "node:assert/strict";
import { parseVerdict, runAgentEvaluation, NoAgentCredentialsError } from "./agent-runner";

test("parseVerdict accepts a well-formed success", () => {
  const v = parseVerdict({ success: true, failStep: "none", summary: "Created form f_1." });
  assert.equal(v.success, true);
  assert.equal(v.failStep, "none");
});

test("parseVerdict refuses success without a clean failStep", () => {
  // A model claiming success while naming a fail step is not a success.
  const v = parseVerdict({ success: true, failStep: "auth", summary: "401 on create" });
  assert.equal(v.success, false);
  assert.equal(v.failStep, "auth");
});

test("parseVerdict falls back to api-call on garbage input", () => {
  const v = parseVerdict({ success: "yes", failStep: "banana" });
  assert.equal(v.success, false);
  assert.equal(v.failStep, "api-call");
  assert.equal(v.summary, "No summary reported.");
});

test("parseVerdict survives null", () => {
  assert.equal(parseVerdict(null).success, false);
});

test("runAgentEvaluation refuses to run without credentials", async () => {
  const saved = process.env.ANTHROPIC_API_KEY;
  delete process.env.ANTHROPIC_API_KEY;
  try {
    await assert.rejects(
      () => runAgentEvaluation("create a form", "https://example.com/docs"),
      NoAgentCredentialsError,
    );
  } finally {
    if (saved !== undefined) process.env.ANTHROPIC_API_KEY = saved;
  }
});
