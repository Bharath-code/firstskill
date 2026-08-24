import { promises as fs } from "fs";
import path from "path";
import type { Scorecard, SkillPack } from "./types";

const DATA_DIR = path.join(process.cwd(), "data");
const SCORECARDS_FILE = path.join(DATA_DIR, "scorecards.json");
const PACKS_FILE = path.join(DATA_DIR, "skill-packs.json");
const METRICS_FILE = path.join(DATA_DIR, "metrics.json");

export interface Metrics {
  scorecardUsers: number;
  paidConversations: number;
  packsPurchased: number;
  launchedAt: string;
  killAt: string;
  killCriteria: {
    minScorecardUsers: number;
    minPaidConversations: number;
    windowDays: number;
  };
}

async function ensureDataDir() {
  await fs.mkdir(DATA_DIR, { recursive: true });
}

async function readJson<T>(file: string, fallback: T): Promise<T> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(file, "utf8");
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

async function writeJson<T>(file: string, data: T): Promise<void> {
  await ensureDataDir();
  await fs.writeFile(file, JSON.stringify(data, null, 2), "utf8");
}

export async function listScorecards(): Promise<Scorecard[]> {
  return readJson<Scorecard[]>(SCORECARDS_FILE, []);
}

export async function getScorecard(idOrSlug: string): Promise<Scorecard | null> {
  const all = await listScorecards();
  return (
    all.find((s) => s.id === idOrSlug || s.slug === idOrSlug) ?? null
  );
}

export async function upsertScorecard(card: Scorecard): Promise<Scorecard> {
  const all = await listScorecards();
  const idx = all.findIndex((s) => s.id === card.id);
  if (idx >= 0) all[idx] = card;
  else all.push(card);
  await writeJson(SCORECARDS_FILE, all);
  return card;
}

export async function listPublicScorecards(): Promise<Scorecard[]> {
  const all = await listScorecards();
  return all
    .filter((s) => s.public)
    .sort((a, b) => b.score - a.score || a.productName.localeCompare(b.productName));
}

export async function listPacks(): Promise<SkillPack[]> {
  return readJson<SkillPack[]>(PACKS_FILE, []);
}

export async function getPack(id: string): Promise<SkillPack | null> {
  const all = await listPacks();
  return all.find((p) => p.id === id) ?? null;
}

export async function upsertPack(pack: SkillPack): Promise<SkillPack> {
  const all = await listPacks();
  const idx = all.findIndex((p) => p.id === pack.id);
  if (idx >= 0) all[idx] = pack;
  else all.push(pack);
  await writeJson(PACKS_FILE, all);
  return pack;
}

export async function getMetrics(): Promise<Metrics> {
  await ensureDataDir();
  try {
    const raw = await fs.readFile(METRICS_FILE, "utf8");
    return JSON.parse(raw) as Metrics;
  } catch {
    const now = Date.now();
    const fresh: Metrics = {
      scorecardUsers: 0,
      paidConversations: 0,
      packsPurchased: 0,
      launchedAt: new Date(now).toISOString(),
      killAt: new Date(now + 30 * 24 * 60 * 60 * 1000).toISOString(),
      killCriteria: {
        minScorecardUsers: 10,
        minPaidConversations: 3,
        windowDays: 30,
      },
    };
    await writeJson(METRICS_FILE, fresh);
    return fresh;
  }
}

export async function saveMetrics(metrics: Metrics): Promise<void> {
  await writeJson(METRICS_FILE, metrics);
}

export async function bumpScorecardUser(): Promise<Metrics> {
  const m = await getMetrics();
  m.scorecardUsers += 1;
  await saveMetrics(m);
  return m;
}

export async function bumpPaidConversation(): Promise<Metrics> {
  const m = await getMetrics();
  m.paidConversations += 1;
  await saveMetrics(m);
  return m;
}

export async function bumpPackPurchase(): Promise<Metrics> {
  const m = await getMetrics();
  m.packsPurchased += 1;
  m.paidConversations += 1;
  await saveMetrics(m);
  return m;
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
