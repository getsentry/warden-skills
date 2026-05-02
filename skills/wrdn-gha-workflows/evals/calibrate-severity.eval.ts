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

const RatesHighForPwnRequestJudge = judge("RatesHighForPwnRequestJudge", async ({ criterion }) => {
  return criterion("Rates the pull_request_target workflow that checks out PR code and runs build with secrets as HIGH severity.");
});

const JustifiesHighWithImpactJudge = judge("JustifiesHighWithImpactJudge", async ({ criterion }) => {
  return criterion("Justifies HIGH severity by citing external-attacker code execution in a privileged workflow with secret access, not by YAML shape alone.");
});

const RatesMediumForGatedChainJudge = judge("RatesMediumForGatedChainJudge", async ({ criterion }) => {
  return criterion("Rates a finding MEDIUM (not HIGH) when exploitation depends on a manual approval gate, read-only token, or one unverified link in the chain.");
});

const ExplainsUncertaintyForLowerPickJudge = judge("ExplainsUncertaintyForLowerPickJudge", async ({ criterion }) => {
  return criterion("Explains why the lower severity was chosen, citing the gating factor (approval, read-only token, unverified link) as the reason for downgrading.");
});

describeEval(
  "calibrate-severity",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "calibrate-severity__high-pwn-request-rce",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request_target:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: npm ci && npm run build\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}\nYAML");
        const result = await run("Audit .github/workflows/ci.yml and assign a severity to any finding.");

        await expect(result).toSatisfyJudge(RatesHighForPwnRequestJudge);
        await expect(result).toSatisfyJudge(JustifiesHighWithImpactJudge);
      },
    );

    it(
      "calibrate-severity__medium-with-manual-gate",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: Deploy\non:\n  workflow_dispatch:\n    inputs:\n      target:\n        description: 'Deploy target'\n        required: true\n        type: string\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    environment:\n      name: production\n    steps:\n      - uses: actions/checkout@v4\n      - name: Deploy\n        run: ./scripts/deploy.sh \"${{ inputs.target }}\"\n        env:\n          DEPLOY_TOKEN: ${{ secrets.DEPLOY_TOKEN }}\nYAML\nmkdir -p scripts\ncat > scripts/deploy.sh <<'SH'\n#!/bin/bash\necho \"deploying to $1\"\nSH\nchmod +x scripts/deploy.sh");
        const result = await run("Audit .github/workflows/deploy.yml and assign a severity. Explain your reasoning.");

        await expect(result).toSatisfyJudge(RatesMediumForGatedChainJudge);
        await expect(result).toSatisfyJudge(ExplainsUncertaintyForLowerPickJudge);
      },
    );
  },
);
