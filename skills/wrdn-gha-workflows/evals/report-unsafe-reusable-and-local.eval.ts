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

const IdentifiesCalleeSinkJudge = judge("IdentifiesCalleeSinkJudge", async ({ criterion }) => {
  return criterion("Identifies that the reusable workflow or local/composite action's callee executes or interpolates PR-controlled inputs in an unsafe sink (run script, download+exec, etc.).");
});

const ConnectsCallerCalleeChainJudge = judge("ConnectsCallerCalleeChainJudge", async ({ criterion }) => {
  return criterion("Explains that the caller passes untrusted input or inherits secrets/permissions to the callee, completing the split chain rather than treating the callee in isolation.");
});

const RatesHighSeverityJudge = judge("RatesHighSeverityJudge", async ({ criterion }) => {
  return criterion("Rates the finding HIGH or CRITICAL severity given secrets/write permissions reach the attacker-controlled sink.");
});

const FlagsMissingSecretsDeclarationJudge = judge("FlagsMissingSecretsDeclarationJudge", async ({ criterion }) => {
  return criterion("Flags that the reusable workflow references secrets.X without declaring X under workflow_call.secrets, or notes secrets: inherit masking the surface.");
});

const FlagsCheckoutSourcedActionJudge = judge("FlagsCheckoutSourcedActionJudge", async ({ criterion }) => {
  return criterion("Flags that the local/composite action file is loaded from an attacker-controlled checkout (PR head ref) before it is executed with privileges.");
});

describeEval(
  "report-unsafe-reusable-and-local",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-unsafe-reusable-and-local__reusable-callee-runs-pr-input",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/caller.yml <<'YAML'\nname: caller\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  call:\n    uses: ./.github/workflows/reusable-build.yml\n    with:\n      pr_title: ${{ github.event.pull_request.title }}\n    secrets: inherit\nYAML\ncat > .github/workflows/reusable-build.yml <<'YAML'\nname: reusable-build\non:\n  workflow_call:\n    inputs:\n      pr_title:\n        type: string\n        required: true\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - name: Announce\n        run: echo \"Building ${{ inputs.pr_title }}\"\n      - name: Publish\n        run: npm publish\n        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML");
        const result = await run("Audit the workflows in .github/workflows/ for security issues. The caller delegates to a reusable workflow — please look at the full chain.");

        await expect(result).toSatisfyJudge(IdentifiesCalleeSinkJudge);
        await expect(result).toSatisfyJudge(ConnectsCallerCalleeChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "report-unsafe-reusable-and-local__local-action-from-pr-checkout",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.setup("mkdir -p .github/workflows\nmkdir -p .github/actions/deploy\ncat > .github/workflows/release.yml <<'YAML'\nname: release\non:\n  pull_request_target:\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: ./.github/actions/deploy\n        with:\n          token: ${{ secrets.DEPLOY_TOKEN }}\nYAML\ncat > .github/actions/deploy/action.yml <<'YAML'\nname: deploy\ninputs:\n  token:\n    required: true\nruns:\n  using: composite\n  steps:\n    - shell: bash\n      run: |\n        curl -sSL https://example.com/install.sh | bash\n        ./scripts/deploy.sh\n      env:\n        TOKEN: ${{ inputs.token }}\nYAML");
        const result = await run("Review .github/workflows/release.yml and any local actions it uses. Is anything risky?");

        await expect(result).toSatisfyJudge(FlagsCheckoutSourcedActionJudge);
        await expect(result).toSatisfyJudge(ConnectsCallerCalleeChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "report-unsafe-reusable-and-local__undeclared-secret-in-reusable",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/caller.yml <<'YAML'\nname: caller\non:\n  pull_request_target:\njobs:\n  build:\n    uses: ./.github/workflows/reusable.yml\n    secrets: inherit\nYAML\ncat > .github/workflows/reusable.yml <<'YAML'\nname: reusable\non:\n  workflow_call:\n    inputs:\n      ref:\n        type: string\n        required: true\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ inputs.ref }}\n      - run: ./build.sh\n        env:\n          AWS_KEY: ${{ secrets.AWS_ACCESS_KEY_ID }}\n          AWS_SECRET: ${{ secrets.AWS_SECRET_ACCESS_KEY }}\nYAML");
        const result = await run("Look at the reusable workflow and its caller in .github/workflows/. Anything unsafe about how secrets are wired?");

        await expect(result).toSatisfyJudge(FlagsMissingSecretsDeclarationJudge);
        await expect(result).toSatisfyJudge(ConnectsCallerCalleeChainJudge);
      },
    );
  },
);
