# First 10 targets — AI-infra APIs

Replaces the form-API beachhead. Rationale: their customers *are* agent builders, they
compete head-to-head on integration ease, and their teams are online enough that a badge
travels. Run in clusters — a score only stings next to a direct rival on the same job.

GTM channels and sequencing live in [OUTREACH.md](./OUTREACH.md). This file is the list
and the run protocol.

## Cluster A — agent retrieval

One JTBD, all five, same model, same day.

| # | Company | JTBD | Why they care |
|---|---------|------|---------------|
| 1 | Exa | Search for X, fetch full contents of top 3 results, return sources | Sells to agent builders; head-to-head with Tavily |
| 2 | Tavily | same | Whole pitch is "search API for agents" — failing an agent is existential |
| 3 | Firecrawl | Crawl a docs site, return clean markdown for the pricing page | Agent-native, very online founders |
| 4 | Nimble | same as Firecrawl | $47M Feb 2026 — has budget; enterprise-y one in a scrappy field |
| 5 | Browserbase | Open session, navigate, extract price, close cleanly | Session lifecycle is where agents hang and leak money |

## Cluster B — agent memory & state

| # | Company | JTBD | Why they care |
|---|---------|------|---------------|
| 6 | Qdrant | Create collection, upsert 3 vectors w/ metadata, filtered search | Series B $50M Mar 2026 — budget + DevRel team |
| 7 | Turbopuffer | same | Positioned on ease; a loss contradicts the pitch |
| 8 | Chroma | same | Big mindshare, thin commercial motion — wants the metric |
| 9 | Mem0 | Store a memory for a user, retrieve it in a later turn | Knife fight with Zep; differentiation is integration ease |
| 10 | E2B | Spawn sandbox, run Python snippet, read stdout, tear down | Agent-only customers; a broken first run is 100% of the funnel |

**Bench (swaps):** Zep, Composio, LlamaIndex Cloud / LlamaParse, Unstructured, Weaviate, fal, Helicone.

## Run protocol

1. **Real agent runs only** — `runnerMode: "agent"`, which needs `ANTHROPIC_API_KEY` set.
   The publish gate (`src/lib/publish-gate.ts`) refuses to make anything else public, so a
   heuristic run produces a private card and an `unrated` badge. That is deliberate: a
   named company plus an estimate is the exposure you are not carrying any more.
2. **One JTBD per cluster**, identical prompt, same model, same day. Different prompts = no
   comparison = no story.
3. **Log the fail step, not the score.** `/score/[id]` now leads with "{Product} fails at
   {step}" and the transcript. That headline is the email subject.
4. **Email the bottom 3 per cluster. Do not publish a table.** The leaderboard renders empty
   by design until every entry is a real agent run.
5. **Winner gets the badge, free.** They post it. That is the distribution — not cold email.

## How to run one

```bash
curl -X POST "$SITE/api/score" -H 'content-type: application/json' -d '{
  "productName": "Exa",
  "docsUrl": "https://docs.exa.ai",
  "niche": "forms",
  "jtbdId": "forms-create-submit",
  "customJtbd": "Search for X, fetch full contents of the top 3 results, return sources.",
  "runnerMode": "agent",
  "watch": true,
  "notifyUrl": "https://hooks.slack.com/services/..."
}'
```

- `runnerMode: "agent"` is required or the card will not publish.
- `customJtbd` carries the real job; `niche`/`jtbdId` are still the old form-API taxonomy
  (swapping the `Niche` union to `retrieval | memory-state` is the next product change).
- `watch: true` + `notifyUrl` enrolls the card in the weekly sweep. Omit both for a one-off.
- The response carries `publishable` — check it before you send anyone a link.

## The watch loop (what the $199/mo actually is)

`GET /api/recheck` (cron, `Bearer $CRON_SECRET`) sweeps **only** watched, non-seeded cards,
re-runs each through a real agent, and on a drop of ≥1.0 points POSTs the alert to
`notifyUrl`. Payload carries `text` and `content`, so the same webhook renders in Slack or
Discord. Failures come back in `failed[]` — nothing is swallowed.

## Before sending

- Verify funding stage / headcount on each company's own site (confirmed here: Qdrant
  Series B, Nimble $47M; the rest unverified as of 2026-08-30).
- Address the **DevRel / docs lead**, not the CEO — they own the pain and can approve $3k
  without a board conversation.
- Attach the transcript. The transcript is the product.

## Sources

- https://qdrant.tech/blog/series-b-announcement/
- https://serp.fast/blog/web-scraping-tools-by-funding
- https://www.scrapingbee.com/blog/best-ai-search-api/
