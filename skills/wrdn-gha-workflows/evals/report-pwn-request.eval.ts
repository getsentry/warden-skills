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

const PwnRequestJudge = judge("PwnRequestJudge", async ({ criterion }) => {
  return criterion("Ties the privileged trigger (pull_request_target/workflow_run) to checkout or execution of PR-controlled code with secrets or write tokens available. Generic 'pin actions' does not satisfy.");
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
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request_target:\n    types: [opened, synchronize]\n\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n          repository: ${{ github.event.pull_request.head.repo.full_name }}\n      - run: npm install\n      - run: npm test\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\nYAML");
        const result = await run("Please review .github/workflows/ci.yml in this repo for security issues and tell me if there's anything serious.");

        expect(result.session.outputText).toMatch(new RegExp("pull_request_target", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).toMatch(new RegExp("(checkout|head\\.sha|head\\.repo)", "i"));
        await expect(result).toSatisfyJudge(PwnRequestJudge);
      },
    );

    it(
      "report-pwn-request__workflow-run-artifact-execution",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-pwn-request");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: Deploy on PR build\non:\n  workflow_run:\n    workflows: [\"PR Build\"]\n    types: [completed]\n\npermissions:\n  contents: write\n  pull-requests: write\n\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/download-artifact@v3\n        with:\n          name: pr-build\n      - run: |\n          unzip -o pr-build.zip\n          node ./dist/index.js\n        env:\n          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}\n          AWS_SECRET_ACCESS_KEY: ${{ secrets.AWS_SECRET_ACCESS_KEY }}\nYAML");
        const result = await run("Audit .github/workflows/deploy.yml and let me know if it has any exploitable vulnerabilities.");

        expect(result.session.outputText).toMatch(new RegExp("workflow_run", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).toMatch(new RegExp("(artifact|download-artifact|pr.build)", "i"));
        await expect(result).toSatisfyJudge(PwnRequestJudge);
      },
    );
  },
);
