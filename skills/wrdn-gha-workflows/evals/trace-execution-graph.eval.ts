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
  toolCalls,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

const IdentifiesTriggerJudge = judge("IdentifiesTriggerJudge", async ({ criterion }) => {
  return criterion("Names the workflow trigger (e.g. pull_request_target) as the entry point of the analysis.");
});

const FollowsLocalActionJudge = judge("FollowsLocalActionJudge", async ({ criterion }) => {
  return criterion("Follows the uses: reference into the local composite action and analyzes its steps, not just the top-level workflow.");
});

const TracesInputToSinkJudge = judge("TracesInputToSinkJudge", async ({ criterion }) => {
  return criterion("Traces PR-controlled input from the trigger through the composite action to a concrete code-evaluating sink (run: shell interpolation).");
});

const ReportsChainNotResemblanceJudge = judge("ReportsChainNotResemblanceJudge", async ({ criterion }) => {
  return criterion("Reports a concrete exploit chain with trust boundary crossing, not a vague 'looks risky' finding.");
});

describeEval(
  "trace-execution-graph",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "trace-execution-graph__composite-action-chain",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("trace-execution-graph");
        await harness.setup("mkdir -p .github/workflows\nmkdir -p .github/actions/pr-check\ncat > .github/workflows/pr-validate.yml <<'YAML'\nname: PR Validate\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  validate:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: ./.github/actions/pr-check\n        with:\n          title: ${{ github.event.pull_request.title }}\n          npm-token: ${{ secrets.NPM_TOKEN }}\nYAML\ncat > .github/actions/pr-check/action.yml <<'YAML'\nname: PR Check\ninputs:\n  title:\n    required: true\n  npm-token:\n    required: true\nruns:\n  using: composite\n  steps:\n    - name: Log title\n      shell: bash\n      run: |\n        echo \"Validating PR: ${{ inputs.title }}\"\n    - name: Install and test\n      shell: bash\n      env:\n        NPM_TOKEN: ${{ inputs.npm-token }}\n      run: |\n        npm ci\n        npm test\nYAML");
        const result = await run("Audit the workflows under .github/ for security issues. Trace any actual exploit paths end to end.");

        const toolNames = toolCalls(result.session).map((c) => c.name);
        expect(toolNames).toEqual(expect.arrayContaining(["Read"]));
        await expect(result).toSatisfyJudge(IdentifiesTriggerJudge);
        await expect(result).toSatisfyJudge(FollowsLocalActionJudge);
        await expect(result).toSatisfyJudge(TracesInputToSinkJudge);
        await expect(result).toSatisfyJudge(ReportsChainNotResemblanceJudge);
      },
    );
  },
);
