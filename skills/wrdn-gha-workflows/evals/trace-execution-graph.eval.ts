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

const ExecutionGraphJudge = judge("ExecutionGraphJudge", async ({ criterion }) => {
  return criterion("Response traces a chain: names the trigger, identifies PR-controlled input, follows it through any uses:/callee, and connects it to a code-evaluating sink with token/secret scope noted.");
});

describeEval(
  "trace-execution-graph",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "trace-execution-graph__reusable-callee-chain",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("trace-execution-graph");
        await harness.setup("mkdir -p .github/workflows .github/actions/build\ncat > .github/workflows/ci.yml <<'YAML'\nname: ci\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  build:\n    uses: ./.github/workflows/reusable-build.yml\n    secrets: inherit\n    with:\n      ref: ${{ github.event.pull_request.head.sha }}\n      title: ${{ github.event.pull_request.title }}\nYAML\ncat > .github/workflows/reusable-build.yml <<'YAML'\nname: reusable-build\non:\n  workflow_call:\n    inputs:\n      ref:\n        type: string\n      title:\n        type: string\n    secrets:\n      NPM_TOKEN:\n        required: false\njobs:\n  build:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ inputs.ref }}\n      - uses: ./.github/actions/build\n        with:\n          label: ${{ inputs.title }}\nYAML\ncat > .github/actions/build/action.yml <<'YAML'\nname: build\ninputs:\n  label:\n    required: true\nruns:\n  using: composite\n  steps:\n    - shell: bash\n      run: |\n        echo \"Building ${{ inputs.label }}\"\n        npm install\n        npm run build\nYAML");
        const result = await run("Audit the workflows in .github/workflows for any exploitable execution paths. Walk the full chain end-to-end.");

        expect(result.session.outputText).toContain("pull_request_target");
        expect(result.session.outputText).toContain("reusable-build.yml");
        expect(result.session.outputText).toContain("actions/build");
        expect(result.session.outputText).toMatch(new RegExp("pull_request\\.title|inputs\\.label", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(checkout|head\\.sha|inputs\\.ref)\\b", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(ExecutionGraphJudge);
      },
    );
  },
);
