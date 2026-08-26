"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import type { Niche } from "@/lib/types";

const NICHES_CLIENT: { id: Niche; label: string }[] = [
  { id: "forms", label: "Form APIs" },
  { id: "payments", label: "Creator payments" },
  { id: "scheduling", label: "Scheduling" },
];

const JTBD_CLIENT: { id: string; niche: Niche; label: string }[] = [
  { id: "forms-create-submit", niche: "forms", label: "Create form + capture one response" },
  { id: "forms-export", niche: "forms", label: "List submissions + export CSV" },
  { id: "payments-charge", niche: "payments", label: "Create product + take $10 charge" },
  { id: "payments-refund", niche: "payments", label: "Refund a test payment" },
  { id: "scheduling-book", niche: "scheduling", label: "Book next available slot" },
  { id: "scheduling-cancel", niche: "scheduling", label: "Cancel and reschedule" },
];

export function ScoreForm() {
  const router = useRouter();
  const [niche, setNiche] = useState<Niche>("forms");
  const [jtbdId, setJtbdId] = useState("forms-create-submit");
  const [productName, setProductName] = useState("");
  const [docsUrl, setDocsUrl] = useState("");
  const [openApiUrl, setOpenApiUrl] = useState("");
  const [email, setEmail] = useState("");
  const [makePublic, setMakePublic] = useState(true);
  const [runnerMode, setRunnerMode] = useState<"heuristic" | "live">("live");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const jtbds = useMemo(
    () => JTBD_CLIENT.filter((j) => j.niche === niche),
    [niche],
  );

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/score", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          productName,
          docsUrl,
          openApiUrl: openApiUrl || undefined,
          niche,
          jtbdId,
          email: email || undefined,
          makePublic,
          runnerMode,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Score failed");
      router.push(`/score/${data.scorecard.slug}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
      setLoading(false);
    }
  }

  return (
    <form onSubmit={onSubmit} className="fs-form">
      <div className="fs-field-row">
        <label className="fs-label">
          Product name
          <input
            className="fs-input"
            required
            value={productName}
            onChange={(e) => setProductName(e.target.value)}
            placeholder="Tally"
          />
        </label>
        <label className="fs-label">
          Docs URL
          <input
            className="fs-input"
            required
            type="url"
            value={docsUrl}
            onChange={(e) => setDocsUrl(e.target.value)}
            placeholder="https://developers.example.com"
          />
        </label>
      </div>

      <div className="fs-field-row">
        <label className="fs-label">
          Niche
          <select
            className="fs-input"
            value={niche}
            onChange={(e) => {
              const n = e.target.value as Niche;
              setNiche(n);
              const first = JTBD_CLIENT.find((j) => j.niche === n);
              if (first) setJtbdId(first.id);
            }}
          >
            {NICHES_CLIENT.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </label>
        <label className="fs-label">
          Job to be done
          <select
            className="fs-input"
            value={jtbdId}
            onChange={(e) => setJtbdId(e.target.value)}
          >
            {jtbds.map((j) => (
              <option key={j.id} value={j.id}>
                {j.label}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="fs-field-row">
        <label className="fs-label">
          OpenAPI URL (optional)
          <input
            className="fs-input"
            type="url"
            value={openApiUrl}
            onChange={(e) => setOpenApiUrl(e.target.value)}
            placeholder="https://api.example.com/openapi.json"
          />
        </label>
        <label className="fs-label">
          Email (for pack follow-up)
          <input
            className="fs-input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@company.com"
          />
        </label>
      </div>

      <div className="fs-eval-mode-box">
        <span className="fs-label-title">Evaluation method</span>
        <div className="fs-eval-mode-toggle">
          <button
            type="button"
            className={`fs-eval-mode-btn ${runnerMode === "live" ? "active" : ""}`}
            onClick={() => setRunnerMode("live")}
          >
            <span className="fs-eval-dot fs-eval-dot--live" />
            <div>
              <strong>Live docs probe</strong>
              <small>Real HTTP checks on your docs, llms.txt and OpenAPI, with latency</small>
            </div>
          </button>
          <button
            type="button"
            className={`fs-eval-mode-btn ${runnerMode === "heuristic" ? "active" : ""}`}
            onClick={() => setRunnerMode("heuristic")}
          >
            <span className="fs-eval-dot" />
            <div>
              <strong>Heuristic estimate</strong>
              <small>Instant scoring from a single documentation crawl</small>
            </div>
          </button>
        </div>
      </div>

      <label className="fs-check">
        <input
          type="checkbox"
          checked={makePublic}
          onChange={(e) => setMakePublic(e.target.checked)}
        />
        Publish score on the public leaderboard
      </label>

      {error && <p className="fs-error">{error}</p>}

      <button className="fs-btn fs-btn--primary" type="submit" disabled={loading}>
        {loading
          ? runnerMode === "live"
            ? "Probing your docs…"
            : "Running agents…"
          : "Get first-success score"}
      </button>
    </form>
  );
}
