"use client";

import { useState } from "react";
import * as Tabs from "@radix-ui/react-tabs";
import * as Dialog from "@radix-ui/react-dialog";

export interface PackSummary {
  id: string;
  productName: string;
  jtbd: string;
  beforeScore: number;
  afterScore: number;
  status: "draft" | "ready" | "purchased";
}

export function PackView({
  pack,
  files,
  fileNames,
  teaser,
}: {
  pack: PackSummary;
  files: Record<string, string> | null;
  fileNames: string[];
  teaser: string;
}) {
  const unlocked = files !== null;
  const [busy, setBusy] = useState(false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [selectedTab, setSelectedTab] = useState<string>(fileNames[0] ?? "SKILL.md");

  async function startCheckout() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/checkout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packId: pack.id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.hint || data.error || "Checkout failed");
      window.location.href = data.checkoutUrl ?? data.redirectUrl;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed");
      setBusy(false);
    }
  }

  function downloadAll() {
    if (!files) return;
    // ponytail: one concatenated file beats N blocked downloads; real .zip if users ask.
    const bundle = Object.entries(files)
      .map(([path, content]) => `\n\n===== ${path} =====\n\n${content}`)
      .join("");
    const url = URL.createObjectURL(new Blob([bundle], { type: "text/plain;charset=utf-8" }));
    const a = document.createElement("a");
    a.href = url;
    a.download = `${pack.productName.replace(/[^a-z0-9]+/gi, "-").toLowerCase()}-skill-pack.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }

  async function copyCurrentContent(key: string, content: string) {
    try {
      await navigator.clipboard.writeText(content);
      setCopiedKey(key);
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      setError("Clipboard unavailable — select the code and copy manually.");
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
        <h2>What’s included in this pack</h2>
        <ul className="fs-include">
          <li><strong>SKILL.md</strong> tuned specifically for &quot;{pack.jtbd}&quot;</li>
          <li><strong>references/</strong> — auth guide, isolated endpoints, JTBD runbook, recoverable errors</li>
          <li><strong>llms.txt snippet</strong> — machine-readable index for instant discovery</li>
          <li><strong>MCP subset notes</strong> — scoped to ≤8 high-relevance tools to prevent agent confusion</li>
          <li><strong>Zero-friction installers</strong> — ready for skills.sh, Claude Code, and Cursor</li>
        </ul>
      </section>

      <section className="fs-section fs-pack-cta">
        <div className="fs-pack-cta-content">
          <div>
            <h2>{unlocked ? "Skill pack unlocked" : "Unlock full agent pack — $197"}</h2>
            <p>
              {unlocked
                ? "Payment confirmed. All files are unlocked and ready to ship."
                : "Standard price $297. Secure checkout and receipts are handled by Dodo Payments."}
            </p>
          </div>

          {!unlocked ? (
            <Dialog.Root open={isModalOpen} onOpenChange={setIsModalOpen}>
              <Dialog.Trigger asChild>
                <button className="fs-btn fs-btn--primary">Unlock pack ($197)</button>
              </Dialog.Trigger>
              <Dialog.Portal>
                <Dialog.Overlay className="fs-dialog-overlay" />
                <Dialog.Content className="fs-dialog-content">
                  <div className="fs-dialog-header">
                    <Dialog.Title className="fs-dialog-title">
                      Unlock {pack.productName} agent skill pack
                    </Dialog.Title>
                    <Dialog.Description className="fs-dialog-desc">
                      Deploy official first-success documentation so Claude Code, Cursor, and Codex choose your API.
                    </Dialog.Description>
                  </div>

                  <div className="fs-dialog-summary">
                    <div className="fs-summary-row">
                      <span>Package tier</span>
                      <strong>Early bird developer license</strong>
                    </div>
                    <div className="fs-summary-row">
                      <span>Included assets</span>
                      <span>SKILL.md + 4 references + MCP subsets</span>
                    </div>
                    <div className="fs-summary-row fs-summary-row--highlight">
                      <span>Total due</span>
                      <strong>$197 USD <small>(regular $297)</small></strong>
                    </div>
                  </div>

                  {error && <p className="fs-error">{error}</p>}

                  <div className="fs-dialog-actions">
                    <button
                      type="button"
                      className="fs-btn fs-btn--primary fs-btn--full"
                      onClick={startCheckout}
                      disabled={busy}
                    >
                      {busy ? "Opening secure checkout…" : "Continue to payment ($197)"}
                    </button>
                    <Dialog.Close asChild>
                      <button type="button" className="fs-btn fs-btn--text">
                        Cancel
                      </button>
                    </Dialog.Close>
                  </div>
                </Dialog.Content>
              </Dialog.Portal>
            </Dialog.Root>
          ) : (
            <button className="fs-btn fs-btn--primary" onClick={downloadAll}>
              Download all files
            </button>
          )}
        </div>
      </section>

      <section className="fs-section">
        <div className="fs-pack-row">
          <h2>Pack file explorer</h2>
          {unlocked && (
            <button className="fs-btn" onClick={downloadAll}>
              Export all files
            </button>
          )}
        </div>

        {unlocked ? (
          <Tabs.Root
            className="fs-tabs-root"
            value={fileNames.includes(selectedTab) ? selectedTab : fileNames[0]}
            onValueChange={setSelectedTab}
          >
            <Tabs.List className="fs-tabs-list" aria-label="Pack files">
              {fileNames.map((path) => (
                <Tabs.Trigger key={path} value={path} className="fs-tabs-trigger">
                  {path}
                </Tabs.Trigger>
              ))}
            </Tabs.List>

            {fileNames.map((path) => (
              <Tabs.Content key={path} value={path} className="fs-tabs-content">
                <div className="fs-code-header">
                  <span className="fs-code-path">{path}</span>
                  <button
                    type="button"
                    className="fs-copy-btn"
                    onClick={() => copyCurrentContent(path, files[path] ?? "")}
                  >
                    {copiedKey === path ? "Copied!" : "Copy code"}
                  </button>
                </div>
                <pre className="fs-code">{files[path]}</pre>
              </Tabs.Content>
            ))}
          </Tabs.Root>
        ) : (
          <div className="fs-locked">
            <ul className="fs-locked-list">
              {fileNames.map((path) => (
                <li key={path}>
                  <span aria-hidden>🔒</span> {path}
                </li>
              ))}
            </ul>
            <div className="fs-code-header">
              <span className="fs-code-path">SKILL.md — preview</span>
            </div>
            <pre className="fs-code fs-code--teaser">{teaser}</pre>
            <p className="fs-muted">Unlock to read all {fileNames.length} files in full.</p>
          </div>
        )}
      </section>
    </div>
  );
}
