import Link from "next/link";
import { ensureSeedScorecards } from "@/lib/seed";
import { listPublicScorecards } from "@/lib/store";
import type { Niche } from "@/lib/types";

export const metadata = {
  title: "Leaderboard — FirstSkill",
};

export default async function LeaderboardPage({
  searchParams,
}: {
  searchParams: Promise<{ niche?: string }>;
}) {
  await ensureSeedScorecards();
  const sp = await searchParams;
  const niche = (sp.niche as Niche | undefined) ?? "forms";
  const all = await listPublicScorecards();
  const cards = all.filter((c) => c.niche === niche);
  const niches: Niche[] = ["forms", "payments", "scheduling"];

  return (
    <section>
      <header className="fs-hero" style={{ paddingBottom: "1rem" }}>
        <p className="fs-kicker">Public leaderboard</p>
        <h1 style={{ maxWidth: "18ch" }}>Who agents can actually finish a job with</h1>
        <p className="fs-lede">
          Beachhead: form APIs. Ranked by first-success score on a shared JTBD.
        </p>
        <div className="fs-cta-row">
          {niches.map((n) => (
            <Link
              key={n}
              className={`fs-btn ${n === niche ? "fs-btn--primary" : ""}`}
              href={`/leaderboard?niche=${n}`}
            >
              {n}
            </Link>
          ))}
        </div>
      </header>

      <div className="fs-table-wrap">
        <table className="fs-table">
          <thead>
            <tr>
              <th>#</th>
              <th>Product</th>
              <th>Score</th>
              <th>Success</th>
              <th>Weakest fail</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {cards.map((c, i) => {
              const fails = c.runs.filter((r) => !r.success).map((r) => r.failStep);
              const weak = fails[0] ?? "none";
              return (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>
                    <Link href={`/score/${c.slug}`}>{c.productName}</Link>
                  </td>
                  <td>
                    <span className="fs-score-pill">{c.score.toFixed(1)}</span>
                  </td>
                  <td>{Math.round(c.successRate * 100)}%</td>
                  <td>
                    <code>{weak}</code>
                  </td>
                  <td>
                    <Link href={`/score/${c.slug}`}>Report</Link>
                  </td>
                </tr>
              );
            })}
            {cards.length === 0 && (
              <tr>
                <td colSpan={6}>No public scores in this niche yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <section className="fs-section">
        <h2>Outreach wedge</h2>
        <p>
          Email the bottom half: “Agents fail your flow at <code>auth</code> /{" "}
          <code>docs</code> — here’s the transcript. Want a FirstSkill pack for $197?”
        </p>
        <pre className="fs-code">{`Subject: Agents fail your ${niche} JTBD at step X

Hey {{name}} —

We ran Claude Code, Cursor Agent, and Codex against your docs on the same job competitors ship.

Your first-success score: {{score}}/10
Fail step: {{failStep}}
Transcript: {{link}}

Tally / peers that agents finish without a human sit higher on https://firstskill.dev/leaderboard?niche=${niche}

We can ship an official SKILL.md + references pack for this JTBD ($197 early bird). Want me to generate it?

— FirstSkill`}</pre>
      </section>
    </section>
  );
}
