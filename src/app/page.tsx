import Link from "next/link";
import { ScoreForm } from "@/components/ScoreForm";
import { ensureSeedScorecards } from "@/lib/seed";
import { listPublicScorecards } from "@/lib/store";

export default async function HomePage() {
  await ensureSeedScorecards();
  const top = (await listPublicScorecards())
    .filter((c) => c.niche === "forms")
    .slice(0, 5);

  return (
    <>
      <section className="fs-hero">
        <p className="fs-kicker">FirstSkill</p>
        <h1>Agents finish one job — or they pick someone else.</h1>
        <p className="fs-lede">
          Free first-success score across Claude, Cursor, and Codex. Then ship an official
          agent skill pack so they keep choosing your API.
        </p>
        <div className="fs-cta-row">
          <Link className="fs-btn fs-btn--primary" href="#score">
            Score your product
          </Link>
          <Link className="fs-btn" href="/leaderboard?niche=forms">
            Form APIs leaderboard
          </Link>
        </div>

        <div className="fs-hero-panel" id="score">
          <h2>Run a free score</h2>
          <ScoreForm />
        </div>
      </section>

      <section className="fs-section">
        <h2>Top form APIs right now</h2>
        <p className="fs-muted">
          Public scores for the beachhead niche. Bottom half gets the outreach email.
        </p>
        <div className="fs-table-wrap">
          <table className="fs-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Product</th>
                <th>Score</th>
                <th>Success</th>
              </tr>
            </thead>
            <tbody>
              {top.map((c, i) => (
                <tr key={c.id}>
                  <td>{i + 1}</td>
                  <td>
                    <Link href={`/score/${c.slug}`}>{c.productName}</Link>
                  </td>
                  <td>
                    <span className="fs-score-pill">{c.score.toFixed(1)}</span>
                  </td>
                  <td>{Math.round(c.successRate * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="fs-section">
        <h2>What we sell (and what we don’t)</h2>
        <p>
          We don’t host MCP for you. We don’t fight Netlify for the “AX” brand. We prove
          agents can complete <em>one</em> money-path job, then deliver the SKILL.md +
          references that raise first-success rate.
        </p>
      </section>
    </>
  );
}
