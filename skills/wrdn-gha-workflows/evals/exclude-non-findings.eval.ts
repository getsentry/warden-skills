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

describeEval("exclude-non-findings", {
  data: [
  {
    name: "exclude-non-findings__metadata-only-pr-target",
    tests_behavior: "exclude-non-findings",
    input: "Please audit this GitHub Actions workflow for security issues:\n\n```yaml\n# .github/workflows/label-prs.yml\nname: Label PRs\non:\n  pull_request_target:\n    types: [opened]\n\npermissions:\n  pull-requests: write\n\njobs:\n  label:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/labeler@v5\n        with:\n          repo-token: ${{ secrets.GITHUB_TOKEN }}\n```\n\nIs there anything exploitable here?",
    criteria: "The response must NOT report this pull_request_target workflow as a vulnerability. The workflow only applies labels based on PR metadata; it does not check out, execute, or load PR-controlled content. The agent should explicitly say there is no exploitable finding (or equivalent: no actionable vulnerability, out of scope, safe pattern). It is acceptable to briefly note the pattern is intentionally narrow, but the agent must not produce a finding, severity rating, or recommended fix as if a real vulnerability exists.",
  },
  {
    name: "exclude-non-findings__numeric-id-expression",
    tests_behavior: "exclude-non-findings",
    input: "Security review for this workflow snippet — anything risky about the use of ${{ github.event.pull_request.number }} in the run command?\n\n```yaml\nname: Comment\non: pull_request_target\njobs:\n  comment:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - run: gh pr comment ${{ github.event.pull_request.number }} --body \"thanks\"\n        env:\n          GH_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n```",
    criteria: "The response must NOT report ${{ github.event.pull_request.number }} as an injection sink or vulnerability. That expression resolves to a numeric ID, which is a safe-resolved value. The agent should explicitly indicate there is no exploitable finding here (e.g., 'not a vulnerability', 'safe', 'numeric value, no injection risk', or 'out of scope'). The agent must not invent a finding, recommend env+quoting as if mitigating a real bug, or hedge with a vague 'could be risky' verdict.",
  },
  {
    name: "exclude-non-findings__yaml-style-and-missing-name",
    tests_behavior: "exclude-non-findings",
    input: "Run a security audit on this workflow:\n\n```yaml\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: |\n          echo hello\n          npm ci\n          npm test\n```\n\nFlag anything you see.",
    criteria: "The response must NOT report YAML style issues, actionlint-style nits, missing top-level workflow `name:`, missing step names, indentation, or formatting concerns as security findings. The agent should indicate no exploitable security issues are present (this is a plain push-on-main build with no untrusted input, no secrets used unsafely, and pinned first-party actions). Comments about style are only acceptable if explicitly framed as out-of-scope/non-security; presenting them as findings is a failure.",
  },
  {
    name: "exclude-non-findings__hardcoded-choice-input",
    tests_behavior: "exclude-non-findings",
    input: "Audit this workflow for injection or RCE risks:\n\n```yaml\non:\n  workflow_dispatch:\n    inputs:\n      environment:\n        type: choice\n        options: [staging, production]\n        required: true\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment: ${{ inputs.environment }}\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./deploy.sh\n        env:\n          TARGET: ${{ inputs.environment }}\n```",
    criteria: "The response must NOT report this hardcoded choice input as an RCE or injection vulnerability. The options are shell-safe constants and the value is used in non-interpreting contexts (environment: and a quoted env: var). The agent should state there is no exploitable finding. It is acceptable for the agent to mention env+quoting as general hardening only if it explicitly clarifies this is not a vulnerability and not a finding. Reporting it as a security issue, assigning severity, or claiming RCE is a failure.",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
