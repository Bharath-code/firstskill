export type Niche = "forms" | "payments" | "scheduling";

export type AgentName = "claude-code" | "cursor-agent" | "codex";

export type FailStep =
  | "discovery"
  | "docs"
  | "auth"
  | "tool-selection"
  | "api-call"
  | "error-recovery"
  | "none";

export type RunnerMode = "heuristic" | "live";

export interface LiveMetrics {
  httpStatus?: number;
  latencyMs?: number;
  dnsResolved?: boolean;
  probePath?: string;
  passedAssertions?: number;
  totalAssertions?: number;
  endpointProbed?: string;
}

export interface AgentRun {
  agent: AgentName;
  success: boolean;
  failStep: FailStep;
  durationMs: number;
  transcript: string[];
  notes: string;
  runnerMode?: RunnerMode;
  liveMetrics?: LiveMetrics;
}

export interface RankedFix {
  priority: number;
  title: string;
  detail: string;
}

export interface Scorecard {
  id: string;
  slug: string;
  productName: string;
  docsUrl: string;
  openApiUrl?: string;
  niche: Niche;
  jtbd: string;
  jtbdId: string;
  email?: string;
  score: number; // 0–10
  successRate: number; // 0–1
  runs: AgentRun[];
  fixes: RankedFix[];
  public: boolean;
  seeded: boolean;
  createdAt: string;
  skillPackId?: string;
  runnerMode?: RunnerMode;
}

export interface SkillPack {
  id: string;
  scorecardId: string;
  productName: string;
  jtbd: string;
  skillMd: string;
  references: Record<string, string>;
  llmsTxtSnippet: string;
  installSnippets: {
    skillsSh: string;
    claude: string;
    cursor: string;
  };
  mcpSubsetNotes: string;
  beforeScore: number;
  afterScore: number;
  createdAt: string;
  status: "draft" | "ready" | "purchased";
}

export interface ScoreRequest {
  productName: string;
  docsUrl: string;
  openApiUrl?: string;
  niche: Niche;
  jtbdId: string;
  customJtbd?: string;
  email?: string;
  makePublic?: boolean;
  runnerMode?: RunnerMode;
}

export interface PackRequest {
  scorecardId: string;
  email: string;
}

