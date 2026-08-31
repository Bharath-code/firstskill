import Link from "next/link";
import { ScoreForm } from "@/components/ScoreForm";

/** The recording is the product, so the page opens with one instead of describing it. */
const TAPE: { t: string; line: string; kind?: "ok" | "bad" | "dead" }[] = [
  { t: "00:01", line: "opening your docs", kind: "ok" },
  { t: "00:04", line: "found the endpoint to create a record", kind: "ok" },
  { t: "00:07", line: "sending the request" },
  { t: "00:07", line: "401 — refused, not signed in", kind: "bad" },
  { t: "00:11", line: 'searching your docs for "api key"' },
  { t: "00:15", line: "no example shows where the key goes", kind: "bad" },
  { t: "00:16", line: "gave up — stuck at signing in", kind: "dead" },
];

const STEPS = [
  {
    n: "01",
    h: "We record it",
    p: "An AI assistant reads your docs and genuinely tries to do one real job on your product. We keep the whole recording, second by second.",
  },
  {
    n: "02",
    h: "We fix what stopped it",
    p: "Usually one missing sentence, one wrong example, one endpoint nobody can find. We repair it and send the assistant back through to prove it now works.",
  },
  {
    n: "03",
    h: "We keep watching",
    p: "You edit your docs constantly. We run the same job every week, forever, and message you the day it stops working again.",
  },
];

export default function HomePage() {
  return (
    <>
      <section className="fs-hero">
        <p className="fs-kicker">FirstSkill</p>
        <h1>Your quietest customer is a robot.</h1>
        <p className="fs-lede">
          Developers now send an AI assistant to read your docs and hook up your product.
          When your docs confuse it, it doesn&rsquo;t email support. It picks a competitor,
          and you never find out. We record it happening.
        </p>
        <div className="fs-cta-row">
          <Link className="fs-btn fs-btn--primary" href="#check">
            Get your recording — free
          </Link>
          <Link className="fs-btn" href="#price">
            See what it costs
          </Link>
        </div>

        <figure className="fs-tape" aria-label="Recording of an AI assistant failing to use an API">
          <figcaption className="fs-tape-head">
            <span className="fs-tape-dot" aria-hidden="true" />
            recording · one real job on a real product
          </figcaption>
          <ol className="fs-tape-body">
            {TAPE.map((l, i) => (
              <li
                key={i}
                className={`fs-tape-line${l.kind ? ` is-${l.kind}` : ""}`}
                style={{ ["--i" as string]: i }}
              >
                <span className="fs-tape-t">{l.t}</span>
                <span className="fs-tape-txt">{l.line}</span>
              </li>
            ))}
          </ol>
          <p className="fs-tape-foot">
            That is a developer who left. Nothing in your dashboard shows it.
          </p>
        </figure>
      </section>

      <section className="fs-section">
        <h2>What we actually do</h2>
        <ol className="fs-steps">
          {STEPS.map((s) => (
            <li key={s.n} className="fs-step">
              <span className="fs-step-n">{s.n}</span>
              <h3>{s.h}</h3>
              <p>{s.p}</p>
            </li>
          ))}
        </ol>
      </section>

      <section className="fs-section">
        <h2>Why it breaks again</h2>
        <p className="fs-lede">
          Docs change every week. Something that worked in March quietly stops working in
          June — and because the assistant never complains, nobody notices until sign-ups
          are already down.
        </p>
        <ol className="fs-weeks" aria-label="Weekly checks, working until week five">
          {["Apr", "May", "Jun", "Jul", "Aug"].map((m, i) => (
            <li
              key={m}
              className={`fs-week${i === 4 ? " is-broken" : ""}`}
              style={{ ["--i" as string]: i }}
            >
              <span className="fs-week-bar" aria-hidden="true" />
              <span className="fs-week-m">{m}</span>
            </li>
          ))}
        </ol>
        <p className="fs-muted">
          Week five is the message you want to get from us, not from a churned customer.
        </p>
      </section>

      <section className="fs-section" id="price">
        <h2>Two things you can buy</h2>
        <div className="fs-plans">
          <article className="fs-plan">
            <p className="fs-plan-price">
              $3,000 <span>once</span>
            </p>
            <h3>Fix it</h3>
            <p>
              Two weeks. We repair whatever stopped the assistant, write the missing
              instructions, and run it again in front of you as proof.
            </p>
          </article>
          <article className="fs-plan fs-plan--lead">
            <p className="fs-plan-price">
              $199 <span>a month</span>
            </p>
            <h3>Keep it fixed</h3>
            <p>
              Every week we run the same job again with a real assistant. The day it stops
              working, we message your team with the recording.
            </p>
          </article>
        </div>
      </section>

      <section className="fs-section fs-hero-panel" id="check">
        <h2>Get your recording</h2>
        <p className="fs-muted">
          Free. Tell us your docs address and the one job that matters, and we send back
          the full recording — including where it stopped.
        </p>
        <ScoreForm />
      </section>

      <section className="fs-section">
        <h2>How to check we&rsquo;re not making this up</h2>
        <p>
          We send the whole recording, not a rating. Every line is a real request to your
          real URL, with the reply we got back. One assistant does the work — Claude — and
          we always say so. If we couldn&rsquo;t run it for real, we tell you that too, and
          the result stays private.
        </p>
      </section>
    </>
  );
}
