"use client";

import { useState } from "react";
import type { Scorecard } from "@/lib/types";
import Link from "next/link";

export function ScorecardView({ card }: { card: Scorecard }) {
  const [email, setEmail] = useState(card.email ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  async function requestPack() {
    if (!email.includes("@")) {
      setMsg("Enter a valid email to generate your skill pack.");
      return;
    }
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/pack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ scorecardId: card.id, email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Pack failed");
      window.location.href = data.checkoutPath;
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  const pct = Math.round(card.successRate * 100);

  return (
    <div className="fs-scorecard">
      <header className="fs-score-hero">
        <p className="fs-kicker">First-success score</p>
        <h1>{card.productName}</h1>
        <p className="fs-lede">{card.jtbd}</p>
        <div className="fs-score-meter" aria-label={`Score ${card.score} of 10`}>
          <span className="fs-score-num">{card.score.toFixed(1)}</span>
          <span className="fs-score-den">/ 10</span>
          <span className="fs-score-rate">{pct}% agent success</span>
        </div>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="fs-badge"
          src={`/api/badge/${card.id}`}
          alt={`first-skill-score ${card.score}`}
          width={220}
          height={36}
        />
      </header>

      <section className="fs-section">
        <h2>Agent runs</h2>
        <ul className="fs-run-list">
          {card.runs.map((run) => (
            <li key={run.agent} className={run.success ? "ok" : "fail"}>
              <div className="fs-run-head">
                <strong>{run.agent}</strong>
                <span>{run.success ? "SUCCESS" : `FAIL @ ${run.failStep}`}</span>
              </div>
              <ol>
                {run.transcript.map((line, i) => (
                  <li key={i}>
                    <code>{line}</code>
                  </li>
                ))}
              </ol>
              <p className="fs-muted">{run.notes}</p>
            </li>
          ))}
        </ul>
      </section>

      <section className="fs-section">
        <h2>Ranked fixes</h2>
        <ol className="fs-fix-list">
          {card.fixes.map((f) => (
            <li key={f.priority}>
              <strong>
                {f.priority}. {f.title}
              </strong>
              <p>{f.detail}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="fs-section fs-pack-cta">
        <h2>Get the official agent skill pack</h2>
        <p>
          $197 early bird (then $297) — SKILL.md, references, llms.txt snippet, MCP subset
          notes, and before/after proof for this JTBD.
        </p>
        <div className="fs-pack-row">
          <input
            className="fs-input"
            type="email"
            placeholder="founder@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="fs-btn fs-btn--primary" onClick={requestPack} disabled={busy}>
            {busy ? "Generating…" : "Generate skill pack"}
          </button>
        </div>
        {msg && <p className="fs-error">{msg}</p>}
        <p className="fs-muted">
          Or browse the{" "}
          <Link href="/leaderboard?niche=forms">form APIs leaderboard</Link>.
        </p>
      </section>
    </div>
  );
}
