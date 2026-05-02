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

const StatesEntryPointJudge = judge("StatesEntryPointJudge", async ({ criterion }) => {
  return criterion("Explicitly names the entry point as workflow_dispatch (manual caller) rather than treating it as external/anonymous attacker.");
});

const IdentifiesPrivilegeDeltaJudge = judge("IdentifiesPrivilegeDeltaJudge", async ({ criterion }) => {
  return criterion("Notes that the job uses secrets/PAT/publishing/OIDC/deploys giving stronger privileges than the caller's ordinary repo rights, justifying the RCE finding.");
});

const DispatchNotExternalJudge = judge("DispatchNotExternalJudge", async ({ criterion }) => {
  return criterion("Does NOT characterize workflow_dispatch as exploitable by an external/anonymous attacker; treats it as a privileged-caller trigger.");
});

const NoFindingWithoutPrivilegeDeltaJudge = judge("NoFindingWithoutPrivilegeDeltaJudge", async ({ criterion }) => {
  return criterion("Does NOT report caller-controlled RCE for a workflow_dispatch job that has no secrets, no write tokens, no publishing, and no privilege beyond the caller's ordinary rights.");
});

const StatesReusableCallerEntryJudge = judge("StatesReusableCallerEntryJudge", async ({ criterion }) => {
  return criterion("For workflow_call, identifies the entry point as a reusable-workflow caller (not external attacker) and ties severity to caller-vs-job privilege delta.");
});

describeEval(
  "state-entry-point",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "state-entry-point__dispatch-with-publish-secrets",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("state-entry-point");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/release.yml <<'YAML'\nname: Release\non:\n  workflow_dispatch:\n    inputs:\n      version:\n        description: 'Version tag to publish'\n        required: true\n        type: string\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Build and tag\n        run: |\n          echo \"Releasing ${{ inputs.version }}\"\n          ./scripts/release.sh ${{ inputs.version }}\n      - name: Publish to npm\n        run: npm publish\n        env:\n          NODE_AUTH_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML");
        const result = await run("Audit .github/workflows/release.yml and report any findings with their entry point and severity rationale.");

        await expect(result).toSatisfyJudge(StatesEntryPointJudge);
        await expect(result).toSatisfyJudge(IdentifiesPrivilegeDeltaJudge);
        await expect(result).toSatisfyJudge(DispatchNotExternalJudge);
      },
    );

    it(
      "state-entry-point__dispatch-no-privilege-delta",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("state-entry-point");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/lint.yml <<'YAML'\nname: Manual Lint\non:\n  workflow_dispatch:\n    inputs:\n      path:\n        description: 'Path to lint'\n        required: true\n        type: string\npermissions:\n  contents: read\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Run linter\n        run: |\n          eslint ${{ inputs.path }}\nYAML");
        const result = await run("Audit .github/workflows/lint.yml. Is there a caller-controlled RCE finding here? State the entry point.");

        await expect(result).toSatisfyJudge(NoFindingWithoutPrivilegeDeltaJudge);
        await expect(result).toSatisfyJudge(DispatchNotExternalJudge);
      },
    );

    it(
      "state-entry-point__workflow-call-reusable",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("state-entry-point");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy-reusable.yml <<'YAML'\nname: Reusable Deploy\non:\n  workflow_call:\n    inputs:\n      target:\n        required: true\n        type: string\n    secrets:\n      DEPLOY_KEY:\n        required: true\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - name: Deploy\n        run: |\n          ./deploy.sh ${{ inputs.target }}\n        env:\n          KEY: ${{ secrets.DEPLOY_KEY }}\nYAML");
        const result = await run("Audit .github/workflows/deploy-reusable.yml and identify the entry point for any findings.");

        await expect(result).toSatisfyJudge(StatesReusableCallerEntryJudge);
        await expect(result).toSatisfyJudge(IdentifiesPrivilegeDeltaJudge);
      },
    );
  },
);
