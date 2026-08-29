# FirstSkill

**Official agent skill packs with first-success proof.**

Agents are becoming the buyer of software. FirstSkill does one job: prove an agent can finish a money-path JTBD on your API, then ship a tested `SKILL.md` pack so agents keep choosing you.

We do **not** compete with Netlify for the “AX” brand. We do **not** host MCP. Score is the lead magnet; the skill pack is the product.

## Quick start

```bash
cd firstskill
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

## Product surfaces

| Path | Purpose |
|------|---------|
| `/` | Landing + free score form |
| `/score` | Score request |
| `/score/[id]` | Public report + pack CTA |
| `/leaderboard?niche=forms` | Public form-API leaderboard (8 seeded) |
| `/pack/[id]` | Skill pack preview + simulated checkout |
| `/kill-criteria` | 30-day GO/NO-GO tracker |
| `/api/badge/[id]` | SVG badge |
| `/api/metrics` | Kill-criteria JSON |

## Pricing (as shipped)

- Free first-success score (heuristic estimate or a real agent run)
- **$197** early-bird skill pack (standard **$297**)
- Checkout is **simulated** until `STRIPE_SECRET_KEY` is wired

## Stack

Next.js App Router, Postgres (Neon). Set `ANTHROPIC_API_KEY` to enable real agent runs; without it scoring falls back to the heuristic runner and says so.

## Kill criteria

After 30 days from launch metrics: need **≥10 scorecard users** and **≥3 paid conversations**. See `/kill-criteria` and `docs/KILL_CRITERIA.md`.

## Learning hook

Refine fail-step attribution in `src/lib/scorer.ts` → `attributeFailStep()`.
