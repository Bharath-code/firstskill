import { test } from "node:test";
import assert from "node:assert/strict";
import { applyRecheck } from "./recheck";
import type { Scorecard } from "./types";

const base: Scorecard = {
  id: "score_1", slug: "acme-1", productName: "Acme", docsUrl: "https://acme.dev/docs",
  niche: "retrieval", jtbd: "search and fetch", jtbdId: "retrieval-search-fetch",
  score: 7.2, successRate: 1, runs: [], fixes: [], public: true, seeded: false,
  createdAt: "2026-01-01T00:00:00.000Z",
};

test("first recheck seeds history from the original score", () => {
  const { card, delta, regressed } = applyRecheck(base, 7.2, "2026-02-01T00:00:00.000Z");
  assert.equal(card.history?.length, 2);
  assert.equal(card.history?.[0].score, 7.2);
  assert.equal(delta, 0);
  assert.equal(regressed, false);
});

test("a drop of a full point is a regression", () => {
  const { card, delta, regressed } = applyRecheck(base, 6.2, "2026-02-01T00:00:00.000Z");
  assert.equal(delta, -1);
  assert.equal(regressed, true);
  assert.equal(card.score, 6.2);
});

test("small drops are noise, not regressions", () => {
  const { regressed } = applyRecheck(base, 6.9, "2026-02-01T00:00:00.000Z");
  assert.equal(regressed, false);
});

test("recovering clears the regressed flag", () => {
  const first = applyRecheck(base, 5.0, "2026-02-01T00:00:00.000Z");
  assert.equal(first.regressed, true);
  const second = applyRecheck(first.card, 7.5, "2026-03-01T00:00:00.000Z");
  assert.equal(second.regressed, false);
  assert.equal(second.card.regressed, false);
});

test("delta compares against the last check, not the original score", () => {
  const first = applyRecheck(base, 5.0, "2026-02-01T00:00:00.000Z");
  const second = applyRecheck(first.card, 4.5, "2026-03-01T00:00:00.000Z");
  assert.equal(second.delta, -0.5);
});

test("history is capped so a weekly cron cannot grow the row forever", () => {
  let card = base;
  for (let i = 0; i < 30; i++) {
    card = applyRecheck(card, 7, `2026-04-${String(i + 1).padStart(2, "0")}T00:00:00.000Z`).card;
  }
  assert.equal(card.history?.length, 12);
});
