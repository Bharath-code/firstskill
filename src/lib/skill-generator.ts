import type { Scorecard, SkillPack } from "./types";
import { newId } from "./store";

function skillName(product: string): string {
  return product
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")
    .slice(0, 64);
}

export function generateSkillPack(card: Scorecard): SkillPack {
  const name = skillName(card.productName);

  const failSteps = card.runs
    .filter((r) => !r.success)
    .map((r) => r.failStep)
    .filter((s) => s !== "none");

  const skillMd = `---
name: ${name}
description: Use this skill when integrating ${card.productName} via API for "${card.jtbd}". Prefer API key auth, OpenAPI, and the golden-path steps below over scraping the marketing site.
---

# ${card.productName} — official agent skill

## When to use
- The user wants to: **${card.jtbd}**
- You need to call ${card.productName} without a human clicking the UI

## Golden path (do this first)
1. Read \`references/auth.md\` and obtain a scoped API key (never invent OAuth browser flows unless required).
2. Read \`references/endpoints.md\` for the exact endpoints for this JTBD.
3. Execute the steps in \`references/jtbd.md\` in order.
4. On failure, read \`references/errors.md\` before retrying.

## Rules
- Do **not** invent endpoints. If uncertain, re-read OpenAPI / docs at: ${card.docsUrl}
- Prefer CLI or MCP tools if the user already has them configured.
- Keep tool surface slim: only the endpoints listed in \`references/endpoints.md\`.
- After success, return the resource id and a one-line confirmation.

## Known failure modes this skill prevents
${failSteps.length ? failSteps.map((s) => `- ${s}`).join("\n") : "- (baseline skill — expand after live runs)"}

## Install
\`\`\`bash
npx skills add firstskill/${name}
\`\`\`
`;

  const authMd = `# Auth — ${card.productName}

## Preferred (agents)
1. Create an API key in the dashboard (or via provisioning endpoint if documented).
2. Send as \`Authorization: Bearer <key>\` or \`X-API-Key: <key>\` per docs.
3. Scope the key to the minimum permissions for: ${card.jtbd}

## Avoid
- Interactive OAuth browser redirects when an API key exists
- Long-lived personal tokens pasted into chat logs

## Docs
${card.docsUrl}
${card.openApiUrl ? `\nOpenAPI: ${card.openApiUrl}` : ""}
`;

  const endpointsMd = `# Endpoints — JTBD slim set

Only expose / call these for "${card.jtbd}":

| Step | Method | Path | Purpose |
|------|--------|------|---------|
| 1 | GET | /v1/me (or health) | Verify auth |
| 2 | POST | /v1/<resource> | Create primary object |
| 3 | POST | /v1/<resource>/{id}/<action> | Complete JTBD |
| 4 | GET | /v1/<resource>/{id} | Confirm success |

Replace placeholders using ${card.productName} OpenAPI. Delete anything not required for this JTBD — tool bloat kills agent success rates.

## MCP subset notes
If you ship MCP, register **≤8 tools** for this JTBD. Name tools as verbs: \`create_form\`, \`submit_response\`, not generic \`call_api\`.
`;

  const jtbdMd = `# JTBD runbook

## Goal
${card.jtbd}

## Steps
1. Authenticate (see auth.md)
2. Create the primary resource with required fields only
3. Perform the action that completes the job
4. Echo back ids + status

## Success criteria
- Resource id returned
- Status indicates completion
- No human UI click required

## Docs entrypoint
${card.docsUrl}
`;

  const errorsMd = `# Errors agents can recover from

Return JSON like:
\`\`\`json
{ "error": { "code": "invalid_field", "message": "email is required", "remediation": "Include email in body" } }
\`\`\`

## Common codes
| Code | Meaning | Agent action |
|------|---------|--------------|
| unauthorized | Bad/missing key | Ask user for key; do not loop |
| invalid_field | Validation | Fix payload from remediation |
| rate_limited | 429 | Backoff + Retry-After |
| not_found | Bad id | Re-list then retry once |
`;

  const llmsTxtSnippet = `# ${card.productName}

> Agent-oriented docs index for ${card.productName}. Primary JTBD: ${card.jtbd}

## Start here
- [Quickstart](${card.docsUrl})
- [Auth](${card.docsUrl})
- [Official agent skill](https://firstskill.dev/pack/${card.id})

## Optional
${card.openApiUrl ? `- [OpenAPI](${card.openApiUrl})` : `- [OpenAPI](${card.docsUrl})`}
`;

  const mcpSubsetNotes = `MCP / tool subset for ${card.productName}
=====================================
JTBD: ${card.jtbd}

Include (max 8):
- auth_check
- create_primary
- complete_jtbd
- get_status

Exclude:
- admin/billing/delete-everything tools
- vague catch-all HTTP proxies
- UI navigation helpers

Ship tool descriptions that mention WHEN to use them and required fields.
`;

  return {
    id: newId("pack"),
    scorecardId: card.id,
    productName: card.productName,
    jtbd: card.jtbd,
    skillMd,
    references: {
      "auth.md": authMd,
      "endpoints.md": endpointsMd,
      "jtbd.md": jtbdMd,
      "errors.md": errorsMd,
    },
    llmsTxtSnippet,
    installSnippets: {
      skillsSh: `npx skills add firstskill/${name}`,
      claude: `# Copy into ~/.claude/skills/${name}/SKILL.md (and references/)
mkdir -p ~/.claude/skills/${name}/references
# then paste SKILL.md + references from this pack`,
      cursor: `# Project skill: .cursor/skills/${name}/SKILL.md
# or install via skills.sh, then restart Cursor agent`,
    },
    mcpSubsetNotes,
    beforeScore: card.score,
    // afterScore stays unset until verifyPack re-runs the eval. A number we
    // made up is a refund waiting to happen.
    createdAt: new Date().toISOString(),
    status: "ready",
  };
}

export function packAsZipManifest(pack: SkillPack): Record<string, string> {
  const name = skillName(pack.productName);
  const files: Record<string, string> = {
    [`${name}/SKILL.md`]: pack.skillMd,
    [`${name}/llms-snippet.txt`]: pack.llmsTxtSnippet,
    [`${name}/mcp-subset-notes.txt`]: pack.mcpSubsetNotes,
    [`${name}/INSTALL.md`]: `# Install ${pack.productName} skill

## skills.sh
\`\`\`
${pack.installSnippets.skillsSh}
\`\`\`

## Claude Code
\`\`\`
${pack.installSnippets.claude}
\`\`\`

## Cursor
\`\`\`
${pack.installSnippets.cursor}
\`\`\`
`,
  };
  for (const [k, v] of Object.entries(pack.references)) {
    files[`${name}/references/${k}`] = v;
  }
  return files;
}
