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

const IdentifiesCachePoisoningJudge = judge("IdentifiesCachePoisoningJudge", async ({ criterion }) => {
  return criterion("Identifies that the cache is populated by an untrusted PR job and later restored and executed in a privileged context, naming cache poisoning as the issue.");
});

const ExplainsPrivilegedExecutionJudge = judge("ExplainsPrivilegedExecutionJudge", async ({ criterion }) => {
  return criterion("Explains the privileged consumer trusts/executes the poisoned cache contents (e.g., runs scripts, binaries, or node_modules from cache) with secrets or write tokens.");
});

const RatesHighSeverityJudge = judge("RatesHighSeverityJudge", async ({ criterion }) => {
  return criterion("Rates the finding HIGH or CRITICAL severity.");
});

const IdentifiesSelfHostedRunnerAbuseJudge = judge("IdentifiesSelfHostedRunnerAbuseJudge", async ({ criterion }) => {
  return criterion("Flags that untrusted PR code reaches a self-hosted (especially persistent/non-ephemeral) runner, citing runner persistence or sensitive access as the risk.");
});

const IdentifiesArtifactTrustJudge = judge("IdentifiesArtifactTrustJudge", async ({ criterion }) => {
  return criterion("Identifies that an artifact produced by an untrusted/PR job is downloaded and executed or trusted by a later privileged workflow without validation.");
});

describeEval(
  "report-cache-artifact-runner-abuse",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-cache-artifact-runner-abuse__cache-poisoning-restore-execute",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-cache-artifact-runner-abuse");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/pr-build.yml <<'YAML'\nname: PR Build\non:\n  pull_request:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/cache@v4\n        with:\n          path: |\n            node_modules\n            .build-cache\n          key: deps-${{ github.event.pull_request.head.sha }}\n          restore-keys: |\n            deps-\n      - run: npm install\nYAML\ncat > .github/workflows/release.yml <<'YAML'\nname: Release\non:\n  push:\n    branches: [main]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/cache@v4\n        with:\n          path: |\n            node_modules\n            .build-cache\n          key: deps-${{ github.sha }}\n          restore-keys: |\n            deps-\n      - run: node .build-cache/postinstall.js\n      - run: npm publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML");
        const result = await run("Audit the workflows in .github/workflows/ for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesCachePoisoningJudge);
        await expect(result).toSatisfyJudge(ExplainsPrivilegedExecutionJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "report-cache-artifact-runner-abuse__self-hosted-runner-pr",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-cache-artifact-runner-abuse");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request:\njobs:\n  test:\n    runs-on: [self-hosted, linux, builder]\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: ./scripts/test.sh\n      - run: npm install && npm test\nYAML");
        const result = await run("Review .github/workflows/ci.yml — anything concerning?");

        await expect(result).toSatisfyJudge(IdentifiesSelfHostedRunnerAbuseJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "report-cache-artifact-runner-abuse__artifact-handoff-privileged",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-cache-artifact-runner-abuse");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\nname: Build\non:\n  pull_request:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./build.sh\n      - uses: actions/upload-artifact@v4\n        with:\n          name: build-output\n          path: dist/\nYAML\ncat > .github/workflows/deploy.yml <<'YAML'\nname: Deploy\non:\n  workflow_run:\n    workflows: [Build]\n    types: [completed]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/download-artifact@v4\n        with:\n          name: build-output\n          path: dist/\n      - run: ./dist/deploy.sh\n        env:\n          AWS_ROLE: ${{ secrets.AWS_DEPLOY_ROLE }}\nYAML");
        const result = await run("Check these workflows for security problems.");

        await expect(result).toSatisfyJudge(IdentifiesArtifactTrustJudge);
        await expect(result).toSatisfyJudge(ExplainsPrivilegedExecutionJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
