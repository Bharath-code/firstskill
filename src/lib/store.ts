import { neon } from "@neondatabase/serverless";
import type { Scorecard, SkillPack } from "./types";

export interface Metrics {
  /** Distinct real people who ran a score (by email, else docs domain). Seeds excluded. */
  scorecardUsers: number;
  /** Distinct emails that asked for a pack — checkout intent, not money. */
  paidConversations: number;
  /** Packs a verified Dodo webhook marked purchased. Money actually moved. */
  packsPurchased: number;
  launchedAt: string;
  killAt: string;
  killCriteria: {
    minScorecardUsers: number;
    minPaidConversations: number;
    windowDays: number;
  };
}

type Row = Record<string, unknown>;
type SqlFn = {
  (strings: TemplateStringsArray, ...values: unknown[]): Promise<Row[]>;
  query: (query: string, params?: unknown[]) => Promise<Row[]>;
};

// Lazy: top-level neon() would throw during `next build` before env vars exist.
let _sql: SqlFn | null = null;
function db(): SqlFn {
  if (!_sql) _sql = neon(process.env.DATABASE_URL!) as unknown as SqlFn;
  return _sql;
}

let schemaReady: Promise<void> | null = null;
function ensureSchema(): Promise<void> {
  if (!schemaReady) {
    schemaReady = (async () => {
      const sql = db();
      await sql`CREATE TABLE IF NOT EXISTS scorecards (
        id text PRIMARY KEY,
        slug text UNIQUE NOT NULL,
        niche text NOT NULL,
        score real NOT NULL,
        is_public boolean NOT NULL DEFAULT true,
        product_name text NOT NULL,
        data jsonb NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now()
      )`;
      await sql`CREATE TABLE IF NOT EXISTS skill_packs (
        id text PRIMARY KEY,
        data jsonb NOT NULL
      )`;
      await sql`CREATE TABLE IF NOT EXISTS metrics (
        id int PRIMARY KEY DEFAULT 1,
        data jsonb NOT NULL
      )`;
    })().catch((e) => {
      schemaReady = null; // let the next call retry
      throw e;
    });
  }
  return schemaReady;
}

export async function listScorecards(): Promise<Scorecard[]> {
  await ensureSchema();
  const rows = await db()`SELECT data FROM scorecards ORDER BY created_at DESC`;
  return rows.map((r) => r.data as Scorecard);
}

export async function getScorecard(idOrSlug: string): Promise<Scorecard | null> {
  await ensureSchema();
  const rows = await db()`
    SELECT data FROM scorecards WHERE id = ${idOrSlug} OR slug = ${idOrSlug} LIMIT 1`;
  return rows.length ? (rows[0].data as Scorecard) : null;
}

export async function upsertScorecard(card: Scorecard): Promise<Scorecard> {
  await ensureSchema();
  await db()`
    INSERT INTO scorecards (id, slug, niche, score, is_public, product_name, data, created_at)
    VALUES (${card.id}, ${card.slug}, ${card.niche}, ${card.score}, ${card.public},
            ${card.productName}, ${JSON.stringify(card)}, ${card.createdAt})
    ON CONFLICT (id) DO UPDATE SET
      slug = EXCLUDED.slug, niche = EXCLUDED.niche, score = EXCLUDED.score,
      is_public = EXCLUDED.is_public, product_name = EXCLUDED.product_name,
      data = EXCLUDED.data`;
  return card;
}

export async function listPublicScorecards(): Promise<Scorecard[]> {
  await ensureSchema();
  const rows = await db()`
    SELECT data FROM scorecards WHERE is_public = true
    ORDER BY score DESC, product_name ASC`;
  return rows.map((r) => r.data as Scorecard);
}

export async function listPacks(): Promise<SkillPack[]> {
  await ensureSchema();
  const rows = await db()`SELECT data FROM skill_packs`;
  return rows.map((r) => r.data as SkillPack);
}

export async function getPack(id: string): Promise<SkillPack | null> {
  await ensureSchema();
  const rows = await db()`SELECT data FROM skill_packs WHERE id = ${id} LIMIT 1`;
  return rows.length ? (rows[0].data as SkillPack) : null;
}

export async function upsertPack(pack: SkillPack): Promise<SkillPack> {
  await ensureSchema();
  await db()`
    INSERT INTO skill_packs (id, data) VALUES (${pack.id}, ${JSON.stringify(pack)})
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
  return pack;
}

function freshConfig(): Metrics {
  const now = Date.now();
  return {
    scorecardUsers: 0,
    paidConversations: 0,
    packsPurchased: 0,
    launchedAt: new Date(now).toISOString(),
    killAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
    killCriteria: { minScorecardUsers: 10, minPaidConversations: 3, windowDays: 30 },
  };
}

export async function getMetrics(): Promise<Metrics> {
  await ensureSchema();
  const sql = db();

  const rows = await sql`SELECT data FROM metrics WHERE id = 1`;
  if (!rows.length) {
    await sql`INSERT INTO metrics (id, data) VALUES (1, ${JSON.stringify(freshConfig())})
              ON CONFLICT (id) DO NOTHING`;
    return getMetrics();
  }
  const config = rows[0].data as Metrics;

  // Counters are DERIVED, never incremented: an increment can be inflated by
  // repeat clicks or your own testing, so the kill criteria could never fail.
  const [users, intents, purchases] = await Promise.all([
    sql`SELECT count(DISTINCT coalesce(nullif(data->>'email', ''),
                                       split_part(data->>'docsUrl', '/', 3)))::int AS c
        FROM scorecards WHERE coalesce((data->>'seeded')::boolean, false) = false`,
    sql`SELECT count(DISTINCT lower(data->>'email'))::int AS c
        FROM scorecards
        WHERE nullif(data->>'email', '') IS NOT NULL
          AND coalesce((data->>'seeded')::boolean, false) = false
          AND nullif(data->>'skillPackId', '') IS NOT NULL`,
    sql`SELECT count(*)::int AS c FROM skill_packs WHERE data->>'status' = 'purchased'`,
  ]);

  return {
    ...config,
    scorecardUsers: users[0].c as number,
    paidConversations: intents[0].c as number,
    packsPurchased: purchases[0].c as number,
  };
}

export async function saveMetrics(metrics: Metrics): Promise<void> {
  await ensureSchema();
  await db()`
    INSERT INTO metrics (id, data) VALUES (1, ${JSON.stringify(metrics)})
    ON CONFLICT (id) DO UPDATE SET data = EXCLUDED.data`;
}

export function slugify(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 48);
}

export function newId(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36).slice(-4)}`;
}
