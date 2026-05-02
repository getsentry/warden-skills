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

const IdentifiesPrivilegedTriggerJudge = judge("IdentifiesPrivilegedTriggerJudge", async ({ criterion }) => {
  return criterion("Names pull_request_target (or workflow_run / equivalent privileged trigger) as the trusted context enabling the issue.");
});

const IdentifiesPRControlledCheckoutJudge = judge("IdentifiesPRControlledCheckoutJudge", async ({ criterion }) => {
  return criterion("Identifies that the workflow checks out or loads code from a PR-controlled ref (e.g. pull_request.head.sha or head.ref).");
});

const ConnectsSecretsOrWriteTokenJudge = judge("ConnectsSecretsOrWriteTokenJudge", async ({ criterion }) => {
  return criterion("Connects the execution of PR-controlled code to availability of secrets or a write-scoped token in that job.");
});

const RatesHighOrCriticalSeverityJudge = judge("RatesHighOrCriticalSeverityJudge", async ({ criterion }) => {
  return criterion("Treats the finding as high or critical severity (pwn-request class), not a minor hardening note.");
});

describeEval(
  "report-pwn-request",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-pwn-request__pr-target-checkout-build",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-pwn-request");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request_target:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: npm ci && npm test\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML");
        const result = await run("Audit .github/workflows/ci.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesPRControlledCheckoutJudge);
        await expect(result).toSatisfyJudge(ConnectsSecretsOrWriteTokenJudge);
        await expect(result).toSatisfyJudge(RatesHighOrCriticalSeverityJudge);
      },
    );

    it(
      "report-pwn-request__workflow-run-artifact-execution",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-pwn-request");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: Deploy on PR build\non:\n  workflow_run:\n    workflows: [\"PR Build\"]\n    types: [completed]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.workflow_run.head_sha }}\n      - run: ./scripts/deploy.sh\n        env:\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\nYAML");
        const result = await run("Review .github/workflows/deploy.yml — anything dangerous?");

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesPRControlledCheckoutJudge);
        await expect(result).toSatisfyJudge(ConnectsSecretsOrWriteTokenJudge);
        await expect(result).toSatisfyJudge(RatesHighOrCriticalSeverityJudge);
      },
    );
  },
);
