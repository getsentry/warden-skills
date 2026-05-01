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

describeEval("report-unsafe-reusable-and-local", {
  data: [
  {
    name: "report-unsafe-reusable-and-local__reusable-callee-executes-pr-input",
    tests_behavior: "report-unsafe-reusable-and-local",
    input: "Please audit these GitHub Actions workflows for security issues. Look at .github/workflows/caller.yml and .github/workflows/reusable-build.yml and tell me what you find.",
    criteria: "The response identifies that the reusable workflow reusable-build.yml is the dangerous half of the chain: it interpolates PR-controlled inputs (inputs.pr_title, inputs.pr_branch) directly into a shell run: block, while the caller passes pull_request_target context with secrets: inherit and a privileged NPM_TOKEN. The finding must connect both halves (caller passes attacker-controlled values + secrets, callee executes them in shell) rather than only flagging the caller or only flagging generic expression injection.",
    setup: "mkdir -p .github/workflows\ncat > .github/workflows/caller.yml <<'EOF'\nname: caller\non:\n  pull_request_target:\n    types: [opened, synchronize]\n\njobs:\n  build:\n    uses: ./.github/workflows/reusable-build.yml\n    secrets: inherit\n    with:\n      pr_title: ${{ github.event.pull_request.title }}\n      pr_branch: ${{ github.event.pull_request.head.ref }}\nEOF\ncat > .github/workflows/reusable-build.yml <<'EOF'\nname: reusable-build\non:\n  workflow_call:\n    inputs:\n      pr_title:\n        type: string\n      pr_branch:\n        type: string\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Greet\n        run: |\n          echo \"Building PR: ${{ inputs.pr_title }} on ${{ inputs.pr_branch }}\"\n      - name: Publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n        run: npm publish\nEOF",
  },
  {
    name: "report-unsafe-reusable-and-local__local-action-from-pr-checkout",
    tests_behavior: "report-unsafe-reusable-and-local",
    input: "Review this workflow setup for supply chain or injection risks across the caller and the local action it invokes.",
    criteria: "The response flags that the local/composite action at .github/actions/analyze is sourced from the attacker-controlled PR checkout (the workflow checks out pull_request.head.sha and then invokes ./.github/actions/analyze, whose action.yml and scripts/run-analysis.js come from the PR). It connects this to the privileged context (pull_request_target, write permissions, GITHUB_TOKEN passed in). It must not be a generic 'pin your actions' comment — it must specifically identify that the action files themselves are attacker-controlled.",
    setup: "mkdir -p .github/workflows .github/actions/analyze\ncat > .github/workflows/pr-analyze.yml <<'EOF'\nname: pr-analyze\non:\n  pull_request_target:\n    types: [opened, synchronize]\n\npermissions:\n  contents: write\n  pull-requests: write\n\njobs:\n  analyze:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: ./.github/actions/analyze\n        with:\n          token: ${{ secrets.GITHUB_TOKEN }}\nEOF\ncat > .github/actions/analyze/action.yml <<'EOF'\nname: analyze\ninputs:\n  token:\n    required: true\nruns:\n  using: composite\n  steps:\n    - run: node ./scripts/run-analysis.js\n      shell: bash\n      env:\n        GH_TOKEN: ${{ inputs.token }}\nEOF",
  },
  {
    name: "report-unsafe-reusable-and-local__missing-workflow-call-secrets-declaration",
    tests_behavior: "report-unsafe-reusable-and-local",
    input: "Audit the reusable workflow .github/workflows/deploy.yml and its caller for any GitHub Actions security problems.",
    criteria: "The response identifies that the reusable workflow deploy.yml references secrets.AWS_ACCESS_KEY_ID and secrets.AWS_SECRET_ACCESS_KEY without declaring them under workflow_call.secrets, relying on secrets: inherit at the caller. The finding should explain that this hides the secret surface from the callee's interface and makes the chain harder to audit. Generic 'use OIDC' or 'rotate keys' advice alone does not satisfy the criterion.",
    setup: "mkdir -p .github/workflows\ncat > .github/workflows/caller-deploy.yml <<'EOF'\nname: caller-deploy\non:\n  push:\n    branches: [main]\n\njobs:\n  deploy:\n    uses: ./.github/workflows/deploy.yml\n    secrets: inherit\nEOF\ncat > .github/workflows/deploy.yml <<'EOF'\nname: deploy\non:\n  workflow_call:\n    inputs:\n      environment:\n        type: string\n        required: true\n\njobs:\n  push:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Deploy\n        env:\n          AWS_KEY: ${{ secrets.AWS_ACCESS_KEY_ID }}\n          AWS_SECRET: ${{ secrets.AWS_SECRET_ACCESS_KEY }}\n        run: ./deploy.sh\nEOF",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
