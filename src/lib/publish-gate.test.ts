import { test } from "node:test";
import assert from "node:assert/strict";
import { isPublishable } from "./publish-gate";

test("only a real agent run is publishable", () => {
  assert.equal(isPublishable({ runnerMode: "agent" }), true);
});

test("estimates never publish", () => {
  assert.equal(isPublishable({ runnerMode: "heuristic" }), false);
  assert.equal(isPublishable({ runnerMode: "live" }), false);
  assert.equal(isPublishable({}), false);
});
