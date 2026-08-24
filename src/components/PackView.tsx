"use client";

import { useState } from "react";
import type { SkillPack } from "@/lib/types";

export function PackView({ pack }: { pack: SkillPack }) {
  const [files, setFiles] = useState<Record<string, string> | null>(null);
  const [status, setStatus] = useState(pack.status);
  const [busy, setBusy] = useState(false);
  const [activeFile, setActiveFile] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function purchase() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id, mode: "simulate" }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Checkout failed");
      setStatus("purchased");
      setFiles(data.files);
      const first = Object.keys(data.files)[0];
      setActiveFile(first ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
    } finally {
      setBusy(false);
    }
  }

  function downloadAll() {
    if (!files) return;
    for (const [path, content] of Object.entries(files)) {
      const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = path.replace(/\//g, "__");
      a.click();
      URL.revokeObjectURL(url);
    }
  }

  return (
    <div className="fs-pack">
      <header className="fs-score-hero">
        <p className="fs-kicker">Official agent skill pack</p>
        <h1>{pack.productName}</h1>
        <p className="fs-lede">{pack.jtbd}</p>
        <div className="fs-before-after">
          <div>
            <span className="fs-muted">Before</span>
            <strong>{pack.beforeScore.toFixed(1)}</strong>
          </div>
          <span aria-hidden>→</span>
          <div>
            <span className="fs-muted">Projected after</span>
            <strong>{pack.afterScore.toFixed(1)}</strong>
          </div>
        </div>
      </header>

      <section className="fs-section">
        <h2>What’s included</h2>
        <ul className="fs-include">
          <li>SKILL.md tuned to this JTBD</li>
          <li>references/ — auth, endpoints, runbook, errors</li>
          <li>llms.txt snippet</li>
          <li>MCP subset notes (≤8 tools)</li>
          <li>Install commands for skills.sh / Claude / Cursor</li>
        </ul>
      </section>

      {status !== "purchased" ? (
        <section className="fs-section fs-pack-cta">
          <h2>Unlock download — $197 early bird</h2>
          <p>Standard price $297. Stripe wires in when you set STRIPE_SECRET_KEY; simulate purchase for now.</p>
          <button className="fs-btn fs-btn--primary" onClick={purchase} disabled={busy}>
            {busy ? "Processing…" : "Simulate purchase & download"}
          </button>
          {error && <p className="fs-error">{error}</p>}
        </section>
      ) : (
        <section className="fs-section">
          <div className="fs-pack-row">
            <h2>Files</h2>
            <button className="fs-btn" onClick={downloadAll}>
              Download all
            </button>
          </div>
          {files && (
            <div className="fs-files">
              <ul>
                {Object.keys(files).map((path) => (
                  <li key={path}>
                    <button
                      type="button"
                      className={activeFile === path ? "active" : ""}
                      onClick={() => setActiveFile(path)}
                    >
                      {path}
                    </button>
                  </li>
                ))}
              </ul>
              <pre className="fs-code">
                {activeFile ? files[activeFile] : "Select a file"}
              </pre>
            </div>
          )}
        </section>
      )}

      <section className="fs-section">
        <h2>SKILL.md preview</h2>
        <pre className="fs-code">{pack.skillMd}</pre>
      </section>
    </div>
  );
}
