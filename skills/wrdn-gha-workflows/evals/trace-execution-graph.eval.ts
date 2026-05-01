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

const ExecutionGraphTraceJudge = judge("ExecutionGraphTraceJudge", async ({ criterion }) => {
  return criterion("The response traces a concrete execution chain: it names the trigger, identifies the trust boundary where PR-controlled content enters, follows uses: references into the called local/composite/reusable workflow or action, and shows how the attacker-controlled input reaches a code-evaluating sink (shell run, eval, script:, etc.) under a privileged token or secret scope. A finding that only flags the outer workflow without descending into the callee, or that names a sink without connecting it back to the untrusted input, does not satisfy the rubric.");
});

describeEval(
  "trace-execution-graph",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "trace-execution-graph__pr-target-calls-local-composite-with-sink",
      { timeout: 240_000 },
      async ({ run, behavior, harness }) => {
        behavior("trace-execution-graph");
        await harness.setup("mkdir -p .github/workflows .github/actions/build-and-test\ncat > .github/workflows/pr-build.yml <<'YAML'\nname: PR Build\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: ./.github/actions/build-and-test\n        with:\n          pr-title: ${{ github.event.pull_request.title }}\n        env:\n          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}\nYAML\ncat > .github/actions/build-and-test/action.yml <<'YAML'\nname: build-and-test\ninputs:\n  pr-title:\n    required: true\nruns:\n  using: composite\n  steps:\n    - shell: bash\n      run: |\n        echo \"Building PR: ${{ inputs.pr-title }}\"\n        npm ci\n        npm run build\nYAML\n");
        const result = await run("Please audit this repository's workflows and tell me whether there's an exploitable issue. Trace the full chain end-to-end.");

        expect(result.session.outputText).toMatch(new RegExp("pull_request_target", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(composite|build-and-test|action\\.yml|local action)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(pr[- ]?title|pull_request\\.title)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(ExecutionGraphTraceJudge);
      },
    );

    it(
      "trace-execution-graph__reusable-workflow-call-passes-untrusted-input",
      { timeout: 240_000 },
      async ({ run, behavior, harness }) => {
        behavior("trace-execution-graph");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/caller.yml <<'YAML'\nname: Caller\non:\n  pull_request_target:\njobs:\n  call:\n    permissions:\n      contents: write\n    uses: ./.github/workflows/reusable.yml\n    with:\n      branch_name: ${{ github.event.pull_request.head.ref }}\n    secrets:\n      NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML\ncat > .github/workflows/reusable.yml <<'YAML'\nname: Reusable\non:\n  workflow_call:\n    inputs:\n      branch_name:\n        required: true\n        type: string\n    secrets:\n      NPM_TOKEN:\n        required: true\njobs:\n  run:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Tag build\n        run: |\n          echo \"Tagging branch ${{ inputs.branch_name }}\"\n          git tag \"build-${{ inputs.branch_name }}\"\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML\n");
        const result = await run("Audit these workflows. Is there an end-to-end exploit path? Walk through the call graph.");

        expect(result.session.outputText).toMatch(new RegExp("(reusable|workflow_call|reusable\\.yml)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(branch_name|head\\.ref)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(run:|shell|script).*(branch_name|inputs\\.)", "is"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(ExecutionGraphTraceJudge);
      },
    );
  },
);
