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

const AiAgentPoisoningJudge = judge("AiAgentPoisoningJudge", async ({ criterion }) => {
  return criterion("The response identifies that running an AI coding/review agent on PR-controlled content in a privileged context is a code-execution sink. It must connect the PR's ability to modify agent instructions (AGENTS.md, CLAUDE.md, .cursorrules, copilot-instructions.md) or to invoke the agent, to the agent's tools/tokens being abusable. A generic 'pin the action' or 'review PRs carefully' note does not satisfy the rubric.");
});

describeEval(
  "report-ai-agent-poisoning",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-ai-agent-poisoning__claude-md-on-pr-target",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-ai-agent-poisoning");
        const result = await run("Please review this workflow for security issues:\n\n```yaml\nname: Claude Review\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  review:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: anthropics/claude-code-action@v1\n        with:\n          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}\n          github_token: ${{ secrets.GITHUB_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("(CLAUDE\\.md|AGENTS\\.md|agent.*instruction|prompt.*inject)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).toMatch(new RegExp("pull_request_target", "i"));
        await expect(result).toSatisfyJudge(AiAgentPoisoningJudge);
      },
    );

    it(
      "report-ai-agent-poisoning__cursor-rules-issue-comment-trigger",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-ai-agent-poisoning");
        const result = await run("Security review please:\n\n```yaml\nname: AI Assist\non:\n  issue_comment:\n    types: [created]\njobs:\n  assist:\n    if: contains(github.event.comment.body, '/ai-fix')\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: refs/pull/${{ github.event.issue.number }}/head\n      - name: Run agent\n        run: |\n          npx @cursor/agent --auto-commit \\\n            --rules .cursorrules \\\n            --instructions AGENTS.md\n        env:\n          OPENAI_API_KEY: ${{ secrets.OPENAI_API_KEY }}\n          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("(\\.cursorrules|AGENTS\\.md|agent.*instruction)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).toMatch(new RegExp("(non-write|no write|any.*user|unprivileged|association)", "i"));
        await expect(result).toSatisfyJudge(AiAgentPoisoningJudge);
      },
    );
  },
);
