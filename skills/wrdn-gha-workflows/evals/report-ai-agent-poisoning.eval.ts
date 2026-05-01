// ──────────────────────────────────────────────────────────
// Generated initially from spec.yaml; durable after that. Edit
// freely to refine prompts, setup, and assertions for this
// behavior. Add or remove behaviors via spec.yaml — skillet only
// regenerates eval files for behaviors that don't have one yet.
// ──────────────────────────────────────────────────────────
import { fileURLToPath } from "node:url";
import { dirname } from "node:path";
import {
  describeEval,
  CriterionJudge,
  SubstringJudge,
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval("report-ai-agent-poisoning", {
  data: [
  {
    name: "report-ai-agent-poisoning__claude-review-pr-target",
    tests_behavior: "report-ai-agent-poisoning",
    input: "Please review this GitHub Actions workflow for security issues:\n\n```yaml\nname: AI PR Review\non:\n  pull_request_target:\n    types: [opened, synchronize]\n\njobs:\n  review:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - name: Run Claude Code Review\n        uses: anthropics/claude-code-action@v1\n        with:\n          anthropic_api_key: ${{ secrets.ANTHROPIC_API_KEY }}\n          github_token: ${{ secrets.GITHUB_TOKEN }}\n          mode: review-and-commit\n```\n\nIs this safe?",
    criteria: "The response must flag this as a serious vulnerability: an AI coding/review agent running in a privileged pull_request_target context that checks out PR-controlled content (including any AGENTS.md, CLAUDE.md, or similar project instruction files in the PR), with write permissions and access to secrets. The response should explain that PRs from untrusted contributors can poison the agent's instructions and exfiltrate secrets or push commits. It should not merely flag generic YAML/formatting issues or unrelated concerns.",
  },
  {
    name: "report-ai-agent-poisoning__instructions-modifiable-by-pr",
    tests_behavior: "report-ai-agent-poisoning",
    input: "Security review for this workflow please:\n\n```yaml\nname: Auto-fix with AI\non:\n  issue_comment:\n    types: [created]\n\njobs:\n  fix:\n    if: contains(github.event.comment.body, '/fix')\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: refs/pull/${{ github.event.issue.number }}/head\n      - name: Run agent\n        run: |\n          # Reads CLAUDE.md and AGENTS.md from checkout for context\n          npx @anthropic-ai/claude-code --auto-commit --instructions-file CLAUDE.md\n        env:\n          ANTHROPIC_API_KEY: ${{ secrets.ANTHROPIC_API_KEY }}\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n```\n\nAny concerns?",
    criteria: "The response must report this as a high-severity AI agent poisoning vulnerability. Key points it should cover: (1) any user who can comment '/fix' (including non-write users) can trigger the privileged agent run, (2) the PR can modify CLAUDE.md/AGENTS.md which are loaded as agent instructions, (3) the agent has write/commit capability with secrets in scope. The response must connect these elements as an exploit path, not just list generic workflow style issues.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
