import { ensureSeedScorecards } from "@/lib/seed";
import { getMetrics } from "@/lib/store";
import { evaluateKillCriteria } from "@/lib/kill-criteria";

export const metadata = {
  title: "Kill criteria — FirstSkill",
};

export default async function KillCriteriaPage() {
  await ensureSeedScorecards();
  const metrics = await getMetrics();
  const { daysLeft, usersOk, paidOk, status } = evaluateKillCriteria(metrics);

  return (
    <section className="fs-hero">
      <p className="fs-kicker">30-day kill criteria</p>
      <h1 style={{ maxWidth: "16ch" }}>Stop if the wedge doesn’t pull.</h1>
      <p className="fs-lede">
        After publishing public scorecards: need ≥10 scorecard users <strong>or</strong>{" "}
        the plan’s stricter bar — ≥10 score users <em>and</em> ≥3 paid conversations.
        We track both; miss either threshold at day 30 → NO-GO.
      </p>

      <div className="fs-kill">
        <p className={`fs-status-${status}`}>
          Status: <strong>{status.toUpperCase()}</strong> — {daysLeft} days left
        </p>
        <dl>
          <dt>Launched</dt>
          <dd>{new Date(metrics.launchedAt).toLocaleDateString()}</dd>
          <dt>Kill date</dt>
          <dd>{new Date(metrics.killAt).toLocaleDateString()}</dd>
          <dt>Scorecard users</dt>
          <dd>
            {metrics.scorecardUsers} / {metrics.killCriteria.minScorecardUsers}{" "}
            {usersOk ? "✓" : ""}
          </dd>
          <dt>Paid conversations</dt>
          <dd>
            {metrics.paidConversations} / {metrics.killCriteria.minPaidConversations}{" "}
            {paidOk ? "✓" : ""}
          </dd>
          <dt>Packs purchased</dt>
          <dd>{metrics.packsPurchased}</dd>
        </dl>
        <p className="fs-muted" style={{ marginTop: "1rem" }}>
          Live JSON: <code>/api/metrics</code>
        </p>
      </div>
    </section>
  );
}
