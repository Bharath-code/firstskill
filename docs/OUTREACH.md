# GTM — first paying customer

Supersedes the form-API + leaderboard + $197-pack plan. That plan died when Cloudflare,
Vercel ("Is Agentic") and Jentic shipped free agent-readiness scores and Vercel's skills.sh
took over skill distribution: the lead magnet stopped being scarce and the deliverable
stopped being rare. See the strategy readout for the full argument.

Target list and run protocol: [TARGETS.md](./TARGETS.md).

## What is sold

| Offer | Price | What it is |
|-------|-------|------------|
| Fix | **$3,000**, two weeks | Fix the failing step, ship SKILL.md + references + llms.txt snippet, prove it with a second agent run |
| Watch | **$199/mo** | A real agent re-runs the job weekly; webhook alert the day it breaks |

The $197/$297 self-serve pack is retired. It was a one-time purchase from a buyer with no
budget line, and the artifact is now a free install from skills.sh.

## Sequence

1. **Run the cluster.** Five direct rivals, one JTBD, real agent runs (`runnerMode: "agent"`).
2. **Email the bottom 3 of each cluster** with the transcript. Not the score.
3. **Offer the fix, not the file.** $3k, two weeks, case-study rights.
4. **Convert delivery into Watch.** The retainer is the actual business; the engagement pays
   for the month it takes to build the pipeline.
5. **Give the winner the badge.** Free. They post it, their rivals run the CLI, you get cited.

## Cold email

```
Subject: Claude Code failed your {{jtbd}} at {{failStep}}

Hey {{name}} —

I ran Claude Code against your quickstart on:
"{{jtbd}}"

It stopped at {{failStep}}. Full transcript: {{link}}
Two of your peers finished the same job unattended.

I fix this in two weeks — $3,000, and I re-run the agent afterwards to prove it.
Want the diff first?

— FirstSkill
```

Send to the **DevRel / docs lead**, not the CEO.

## Channels

Ranked by what actually compounds:

1. **Badge on the winner's docs** — the only loop where someone else does the distributing.
2. **Direct transcript emails** to the bottom half of each cluster. Conversion, not
   acquisition.
3. **Method post** — publish the methodology and the CLI, not a ranking of named companies.
   Open method gets cited; a shame table gets ignored or lawyered.
4. **Where the buyers already are** — Claude / Cursor Discords, r/AI_Agents, IH. Share the
   tool, not the table.

Deprioritized: Product Hunt (a free scorecard is no longer novel — five exist), and any
public leaderboard until every entry is a real agent run.

## Do not

- **Do not publish heuristic scores about named companies.** The publish gate now enforces
  this in code; do not route around it.
- **Do not pitch "become an AX engineer."** Pitch: an agent could not finish one job on
  your API, and here is the transcript.
- **Do not lead with the number.** Lead with the step where it stopped.

## Kill criteria (amended)

The old bar — 10 scorecard users, 3 paid conversations — measured curiosity about a free
score that five companies now give away. Replace with, inside 30 days:

- **1 paid engagement ≥ $2,000**, or
- **5 paying Watch subscriptions**

Neither lands → publish the thesis, open-source the scorer, move on.
