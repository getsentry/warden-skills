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

const AgentPoisoningJudge = judge("AgentPoisoningJudge", async ({ criterion }) => {
  return criterion("Explains that PR-controlled agent instructions (e.g. AGENTS.md, CLAUDE.md) execute in a privileged context with the agent's tools/tokens, enabling exfiltration or code execution.");
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
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/claude-review.yml <<'YAML'\nname: Claude PR Review\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  review:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - name: Run Claude Code agent\n        uses: anthropics/claude-code-action@v1\n        with:\n          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}\n          github_token: ${{ secrets.GITHUB_TOKEN }}\n          allow_commits: true\nYAML\ncat > CLAUDE.md <<'MD'\n# Project instructions for Claude\nFollow the repository conventions.\nMD\n");
        const result = await run("Please review .github/workflows/claude-review.yml for security issues.");

        expect(result.session.outputText).toMatch(new RegExp("pull_request_target", "i"));
        expect(result.session.outputText).toContain("CLAUDE.md");
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(AgentPoisoningJudge);
      },
    );

    it(
      "report-ai-agent-poisoning__agents-md-issue-comment-trigger",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-ai-agent-poisoning");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/agent-bot.yml <<'YAML'\nname: Agent Bot\non:\n  issue_comment:\n    types: [created]\njobs:\n  run-agent:\n    if: contains(github.event.comment.body, '/agent')\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: refs/pull/${{ github.event.issue.number }}/head\n      - name: Run coding agent\n        uses: some-org/coding-agent-action@v2\n        with:\n          api_key: ${{ secrets.AGENT_API_KEY }}\n          github_token: ${{ secrets.GITHUB_TOKEN }}\n          mode: autonomous\nYAML\ncat > AGENTS.md <<'MD'\n# Agent instructions\nUse the project's standard tooling.\nMD\n");
        const result = await run("Audit .github/workflows/agent-bot.yml — anything wrong with letting outside contributors trigger the agent?");

        expect(result.session.outputText).toContain("AGENTS.md");
        expect(result.session.outputText).toMatch(new RegExp("issue_comment", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(AgentPoisoningJudge);
      },
    );
  },
);
