# Kill criteria (30 days)

From the plan:

> Kill criteria (NO-GO after 30 days): fewer than 10 scorecard users **or** fewer than 3 paid conversations after publishing 5 public competitor scorecards.

## Thresholds tracked in-app

| Metric | Minimum | Source |
|--------|---------|--------|
| Scorecard users | 10 | Incremented on each `POST /api/score` |
| Paid conversations | 3 | Incremented on pack generate (`POST /api/pack`) and purchase (`POST /api/checkout`) |
| Public scorecards | 5+ | Seeded form-API leaderboard ships 8 |

## How to check

- UI: `/kill-criteria`
- API: `GET /api/metrics`

## Decision

- **Before day 30:** status `tracking` or early `pass` if both bars cleared.
- **On/after day 30:** `pass` if both bars met, else `kill` → stop building, keep content only or pivot.

Launched-at and kill-at are stored in `data/metrics.json` on first seed.
