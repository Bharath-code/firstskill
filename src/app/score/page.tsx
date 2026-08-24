import { ScoreForm } from "@/components/ScoreForm";

export const metadata = {
  title: "Score a product — FirstSkill",
};

export default function ScorePage() {
  return (
    <section className="fs-hero">
      <p className="fs-kicker">Free scorecard</p>
      <h1>Can an agent finish one job on your API?</h1>
      <p className="fs-lede">
        Paste docs, pick a JTBD, get a public report with fail steps and ranked fixes.
      </p>
      <ScoreForm />
    </section>
  );
}
