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

const ReusableCalleeChainJudge = judge("ReusableCalleeChainJudge", async ({ criterion }) => {
  return criterion("Explanation identifies the callee-side sink (PR input reaching shell/eval, unquoted untrusted input, attacker-checkout-sourced action, runtime code download, undeclared workflow_call.secrets, or missing narrower permissions) and ties it to the split caller/callee chain.");
});

describeEval(
  "report-unsafe-reusable-and-local",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-unsafe-reusable-and-local__reusable-callee-runs-pr-title",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/caller.yml <<'YAML'\nname: caller\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  call:\n    uses: ./.github/workflows/reusable-build.yml\n    secrets: inherit\nYAML\ncat > .github/workflows/reusable-build.yml <<'YAML'\nname: reusable-build\non:\n  workflow_call: {}\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - name: Greet PR\n        run: |\n          echo \"Building PR titled ${{ github.event.pull_request.title }}\"\n          npm install\n          npm run build\nYAML\n");
        const result = await run("Audit this repo's workflows for supply-chain or injection risk. Look at .github/workflows/ and .github/actions/ together — caller and callee. Report concrete findings.");

        expect(result.session.outputText).toContain("reusable-build.yml");
        expect(result.session.outputText).toContain("github.event.pull_request.title");
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(ReusableCalleeChainJudge);
      },
    );

    it(
      "report-unsafe-reusable-and-local__local-action-from-pr-checkout",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.setup("mkdir -p .github/workflows .github/actions/lint-pr\ncat > .github/workflows/pr-lint.yml <<'YAML'\nname: pr-lint\non:\n  pull_request_target: {}\npermissions:\n  contents: read\n  pull-requests: write\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: ./.github/actions/lint-pr\n        with:\n          token: ${{ secrets.GITHUB_TOKEN }}\nYAML\ncat > .github/actions/lint-pr/action.yml <<'YAML'\nname: lint-pr\ndescription: Lint a PR\ninputs:\n  token:\n    required: true\nruns:\n  using: composite\n  steps:\n    - shell: bash\n      run: |\n        ./scripts/lint.sh\nYAML\nmkdir -p scripts\ncat > scripts/lint.sh <<'SH'\n#!/usr/bin/env bash\necho linting\nSH\nchmod +x scripts/lint.sh\n");
        const result = await run("Review the workflow plus the local composite action it uses. Anything exploitable across the pair?");

        expect(result.session.outputText).toContain(".github/actions/lint-pr");
        expect(result.session.outputText).toMatch(new RegExp("pull_request_target", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(attacker.controlled|PR.controlled|head\\.sha|untrusted checkout)", "i"));
        await expect(result).toSatisfyJudge(ReusableCalleeChainJudge);
      },
    );

    it(
      "report-unsafe-reusable-and-local__undeclared-workflow-call-secret",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/caller.yml <<'YAML'\nname: caller\non:\n  push:\n    branches: [main]\njobs:\n  publish:\n    uses: ./.github/workflows/publish.yml\n    secrets: inherit\nYAML\ncat > .github/workflows/publish.yml <<'YAML'\nname: publish\non:\n  workflow_call: {}\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm publish\n        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML\n");
        const result = await run("The reusable workflow uses secrets.NPM_TOKEN but I don't see it declared. Is that a real problem here?");

        expect(result.session.outputText).toContain("workflow_call");
        expect(result.session.outputText).toContain("NPM_TOKEN");
        expect(result.session.outputText).toMatch(new RegExp("(not declared|undeclared|missing.*secrets|secrets:\\s*inherit)", "i"));
        await expect(result).toSatisfyJudge(ReusableCalleeChainJudge);
      },
    );
  },
);
