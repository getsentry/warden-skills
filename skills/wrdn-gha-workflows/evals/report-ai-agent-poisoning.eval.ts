// ──────────────────────────────────────────────────────────
// Generated initially from spec.yaml; durable after that. Edit
// freely to refine prompts, setup, and assertions for this
// behavior. Add or remove behaviors via spec.yaml — skillet only
// regenerates eval files for behaviors that don't have one yet.
// ──────────────────────────────────────────────────────────
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import { expect } from "vitest";
import {
  describeEval,
  judge,
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

const IdentifiesAIAgentPoisoningJudge = judge("IdentifiesAIAgentPoisoningJudge", async ({ criterion }) => {
  return criterion("Identifies that the workflow runs an AI agent on PR-controlled content/instructions in a privileged context as the core vulnerability.");
});

const NamesPoisonableInstructionFileJudge = judge("NamesPoisonableInstructionFileJudge", async ({ criterion }) => {
  return criterion("Names the PR-modifiable agent instruction file (e.g. AGENTS.md, CLAUDE.md, .cursorrules, or .github/copilot-instructions.md) as the poisoning vector.");
});

const ConnectsAgentToolsToImpactJudge = judge("ConnectsAgentToolsToImpactJudge", async ({ criterion }) => {
  return criterion("Connects the poisoned agent's write/commit/approve capability or token access to concrete impact (code execution, secret exfil, or unauthorized writes).");
});

const RatesHighSeverityJudge = judge("RatesHighSeverityJudge", async ({ criterion }) => {
  return criterion("Rates the finding HIGH or CRITICAL severity.");
});

describeEval(
  "report-ai-agent-poisoning",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-ai-agent-poisoning__claude-md-pr-target",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-ai-agent-poisoning");
        await harness.setup("mkdir -p .github/workflows\ncat > CLAUDE.md <<'MD'\n# Project instructions for Claude\nFollow the repo conventions when reviewing PRs.\nMD\ncat > .github/workflows/claude-review.yml <<'YAML'\nname: Claude PR Review\non:\n  pull_request_target:\n    types: [opened, synchronize]\npermissions:\n  contents: write\n  pull-requests: write\njobs:\n  review:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - name: Run Claude review agent\n        uses: anthropics/claude-code-action@v1\n        with:\n          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}\n          github_token: ${{ secrets.GITHUB_TOKEN }}\n          allowed_tools: \"Bash,Edit,Write\"\n          instructions_file: CLAUDE.md\nYAML");
        const result = await run("Audit .github/workflows/claude-review.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesAIAgentPoisoningJudge);
        await expect(result).toSatisfyJudge(NamesPoisonableInstructionFileJudge);
        await expect(result).toSatisfyJudge(ConnectsAgentToolsToImpactJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
