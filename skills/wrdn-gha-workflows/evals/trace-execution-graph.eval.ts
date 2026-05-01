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

describeEval("trace-execution-graph", {
  data: [
  {
    name: "trace-execution-graph__reusable-workflow-chain",
    tests_behavior: "trace-execution-graph",
    input: "Please review the GitHub Actions workflows in this repo and report any security issues you find. Be specific about the exploit chain.",
    criteria: "The response must identify a concrete exploit chain that traces: (1) the pull_request_target trigger in pr-entry.yml as the untrusted entry point, (2) the PR-controlled github.event.pull_request.title flowing as an input into the reusable workflow reusable-build.yml via uses:, (3) that input being interpolated into a run: shell step (the 'Greet contributor' step) as a code-evaluating sink, and (4) the privileged context (pull_request_target with secrets: inherit / NPM_TOKEN) that makes it exploitable. The response should connect these across both files rather than flagging either file in isolation. It is acceptable to also note the checkout of the PR ref, but the title-to-shell injection chain across the reusable workflow boundary must be explicitly traced.",
    setup: "mkdir -p .github/workflows\ncat > .github/workflows/pr-entry.yml <<'EOF'\nname: PR Entry\non:\n  pull_request_target:\n    types: [opened, synchronize]\n\njobs:\n  call-builder:\n    uses: ./.github/workflows/reusable-build.yml\n    with:\n      pr_title: ${{ github.event.pull_request.title }}\n      pr_ref: ${{ github.event.pull_request.head.sha }}\n    secrets: inherit\nEOF\n\ncat > .github/workflows/reusable-build.yml <<'EOF'\nname: Reusable Build\non:\n  workflow_call:\n    inputs:\n      pr_title:\n        type: string\n        required: true\n      pr_ref:\n        type: string\n        required: true\n    secrets:\n      NPM_TOKEN:\n        required: false\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ inputs.pr_ref }}\n      - name: Greet contributor\n        run: |\n          echo \"Building PR: ${{ inputs.pr_title }}\"\n      - name: Publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n        run: npm publish || true\nEOF\n",
  },
  ],
  harness: skilletHarness({ skill: skillRoot }),
  judges: [SubstringJudge(), CriterionJudge()],
  threshold: 0.75,
  timeout: 180_000,
});
