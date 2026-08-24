# FirstSkill — Business Reference

Saved for later. Snapshot of revenue model, ICP, chargeability, live-ready checklist, and growth potential.

---

## Revenue model

| Layer | Price | What they buy |
|-------|-------|----------------|
| Free | $0 | First-success score + public report (lead magnet) |
| Pack (v1) | **$197** early / **$297** standard | One JTBD: `SKILL.md` + references + install notes + before/after |
| Watch (v2, not built) | **$49–99/mo** | Re-score when docs change + skill updates |

**How money actually flows:** free score → shame/FOMO from leaderboard → email → paid pack. Later: convert packs into monitoring subs.

Honest ceiling (solo, if the wedge works): **~$5–15k MRR**, not a platform unicorn.

---

## ICP (who pays)

**Primary:** Founders / DX leads at **API-first indie or small B2B SaaS** (roughly 1–50 eng) who want Claude/Cursor users to integrate them.

**Beachhead niche we seeded:** **Form APIs** (Tally, Typeform, Jotform, Fillout, etc.).

**Buyer pain:** “Agents recommend a worse competitor because ours is harder to call.”

**Not ICP (yet):** Enterprises, pure marketing AEO buyers, people who only want a pretty dashboard.

### Where they are

| Place | Why |
|-------|-----|
| Indie Hackers, r/SaaS, r/AI_Agents | Solo/small founders shipping APIs |
| Claude / Cursor Discords | People already routing work through agents |
| Product Hunt | Free scorecard launch |
| Cold email / LinkedIn to bottom of *our* leaderboard | Highest intent — they already “lost” publicly |
| AX thesis post CTA | Content → free score |

---

## Can we charge them today?

**Not for self-serve card payments yet.**

| Capability | Status | Chargeable? |
|------------|--------|-------------|
| Free score + report UI | Working (heuristic agent sims, not live Claude/Cursor) | Lead magnet only |
| Leaderboard (8 form APIs) | Working | Marketing |
| Skill pack generation | Working (template quality; needs human polish for first customers) | **Yes as done-for-you / manual invoice** |
| Stripe Checkout | **Stub** (`simulate` only) | **No real money** |
| Monthly watch / regression | Not built | No |
| Live multi-agent runs | Not built | Credibility risk if you overclaim |

**Practical charge path today:** sell the **$197 pack as a service** (generate in product → you edit → send zip → invoice via Stripe Payment Link / Wise). Don’t put a live “pay now” button until Stripe is wired and you disclose scores are heuristic (or upgrade to real agent runs).

---

## Live-ready checklist

### Ready now

- [x] Brand/positioning (FirstSkill, not “AX platform”)
- [x] Landing + score form
- [x] Public score reports
- [x] Form-API leaderboard + outreach copy
- [x] Pack artifact generation (SKILL.md, references, llms snippet, MCP notes)
- [x] Kill-criteria tracker (`/kill-criteria`, `/api/metrics`)
- [x] Local app runs (`npm run dev`)

### Blockers before “live paid SaaS”

- [ ] Real **Stripe Checkout** (not simulate)
- [ ] Honest copy: scores are **heuristic** until live agents ship
- [ ] Deploy (Vercel + durable DB; file JSON is fine for demos only)
- [ ] Domain + email (firstskill.dev / transactional mail)
- [ ] Terms / “not a guarantee of agent success” disclaimer
- [ ] Manual QA of first 3 paid packs (human-in-the-loop)

### Nice-to-have before scaling

- [ ] Live agent runners (Claude/Cursor/Codex)
- [ ] Zip download as one file
- [ ] $49–99/mo regression watch
- [ ] Auth / customer accounts

**Verdict:** **Demo / concierge-ready. Not self-serve charge-ready.**

---

## Growth potential

| Horizon | Outlook |
|---------|---------|
| 30 days | Prove wedge: ≥10 score users + ≥3 real paid chats (plan kill bar) |
| 3 months | If packs convert: tens of customers, low–mid four figures/mo |
| 12 months | Own “official skill + proof” for 2–3 niches (forms → payments → scheduling) → **$5–15k MRR** plausible |
| Upside risk | Netlify/AXIS or Mintlify-like tools absorb “score”; OpenAPI→MCP hosts steal “ship MCP.” Defense is **tested skill + JTBD proof**, not hosting |

**Growth shape:** content + public scorecards (virality) → outbound to losers on the board → packs → subscriptions. Not ads-heavy PLG until Stripe + real agents exist.

---

## Bottom line

Revenue model is clear (**free score → $197–297 pack → later sub**). ICP is **API-first SaaS founders**, starting with **form APIs**, found on **IH / Reddit / Discords / cold outbound from the leaderboard**. Product is **good enough to sell manually**; **not** good enough to auto-charge strangers until Stripe + credibility fixes land.

---

*Written 2026-08-24. Related: [BRAND.md](./BRAND.md), [OUTREACH.md](./OUTREACH.md), [KILL_CRITERIA.md](./KILL_CRITERIA.md), [../README.md](../README.md).*
