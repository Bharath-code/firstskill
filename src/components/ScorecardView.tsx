"use client";

import { useState } from "react";
import type { RunnerMode, Scorecard } from "@/lib/types";

const MODE_LABELS: Record<RunnerMode, string> = {
  agent: "Real agent run",
  live: "Live docs probe",
  heuristic: "Heuristic estimate",
};

export function ScorecardView({ card }: { card: Scorecard }) {
  const [email, setEmail] = useState(card.email ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Env, not window.location: the snippet is copied into someone else's README,
  // so it must render identically on the server and never point at a preview host.
  const origin = process.env.NEXT_PUBLIC_SITE_URL ?? "https://firstskill.dev";
  const reportUrl = `${origin}/score/${card.slug}`;
  const badgeMarkdown = `[![first-skill-score ${card.score.toFixed(1)}/10](${origin}/api/badge/${card.id})](${reportUrl})`;

  async function copyBadge() {
    try {
      await navigator.clipboard.writeText(badgeMarkdown);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setMsg("Clipboard unavailable — select the snippet and copy manually.");
    }
  }

  async function requestPack() {
    if (!email.includes("@")) {
      setMsg("Enter a valid email so I can send the fix scope.");
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
  // The transcript is what sells the fix, so the failing step leads the page —
  // the number is a footnote nobody forwards to their team.
  const failed = card.runs.find((r) => !r.success);
  const publishable = card.runnerMode === "agent";

  return (
    <div className="fs-scorecard">
      <header className="fs-score-hero">
        <p className="fs-kicker">{failed ? "Where the agent stopped" : "Agent finished the job"}</p>
        <h1>
          {failed ? `${card.productName} fails at ${failed.failStep}` : `${card.productName} passes`}
        </h1>
        <p className="fs-lede">{card.jtbd}</p>
        <div className="fs-score-meter" aria-label={`Score ${card.score} of 10`}>
          <span className="fs-score-num">{card.score.toFixed(1)}</span>
          <span className="fs-score-den">/ 10</span>
          <span className="fs-score-rate">{pct}% agent success</span>
        </div>
        {publishable ? (
          <a href={reportUrl}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="fs-badge"
              src={`/api/badge/${card.id}`}
              alt={`first-skill-score ${card.score}`}
              width={220}
              height={36}
            />
          </a>
        ) : (
          <p className="fs-muted">
            Estimate only — no real agent run, so this report stays private and unbadged.
          </p>
        )}
      </header>

      {publishable && (
        <section className="fs-section fs-badge-embed">
          <div className="fs-section-header">
            <h2>Put this in your README</h2>
          </div>
          <p className="fs-muted">
            The badge re-renders on every check, so it stays honest as your API changes.
          </p>
          <div className="fs-badge-embed-row">
            <code className="fs-badge-embed-code">{badgeMarkdown}</code>
            <button type="button" className="fs-copy-btn" onClick={copyBadge}>
              {copied ? "Copied" : "Copy"}
            </button>
          </div>
        </section>
      )}

      <section className="fs-section">
        <div className="fs-section-header">
          <h2>Agent runs</h2>
          <span className={`fs-mode-pill ${card.runnerMode === "heuristic" ? "" : "fs-mode-pill--live"}`}>
            {MODE_LABELS[card.runnerMode ?? "heuristic"]}
          </span>
        </div>
        <ul className="fs-run-list">
          {card.runs.map((run) => (
            <li key={run.agent} className={run.success ? "ok" : "fail"}>
              <div className="fs-run-head">
                <div className="fs-run-title-group">
                  <strong>{run.agent}</strong>
                  {run.liveMetrics && (
                    <span className="fs-live-metric-tag">
                      {run.liveMetrics.latencyMs}ms • {run.liveMetrics.passedAssertions}/{run.liveMetrics.totalAssertions} assertions passed
                    </span>
                  )}
                </div>
                <span className={`fs-status-pill ${run.success ? "fs-status-pill--ok" : "fs-status-pill--fail"}`}>
                  {run.success ? "SUCCESS" : `FAIL @ ${run.failStep}`}
                </span>
              </div>
              <ol>
                {run.transcript.map((line, i) => (
                  <li key={i}>
                    <code>{line}</code>
                  </li>
                ))}
              </ol>
              <div className="fs-run-foot">
                <p className="fs-muted">{run.notes}</p>
                <span className="fs-run-duration">Duration: {(run.durationMs / 1000).toFixed(2)}s</span>
              </div>
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
        <h2>Fix it, then keep it fixed</h2>
        <p>
          <strong>$3,000 — two weeks.</strong> I fix the step above and ship the SKILL.md,
          references and llms.txt snippet, with a second agent run as proof.
        </p>
        <p>
          <strong>$199/mo — weekly watch.</strong> A real agent re-runs this job every week
          and posts to your Slack the day it breaks.
        </p>
        <div className="fs-pack-row">
          <input
            className="fs-input"
            type="email"
            placeholder="you@company.com"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <button className="fs-btn fs-btn--primary" onClick={requestPack} disabled={busy}>
            {busy ? "Sending…" : "Start the fix"}
          </button>
        </div>
        {msg && <p className="fs-error">{msg}</p>}
      </section>
    </div>
  );
}
