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
  return criterion("The response identifies the workflow as a pwn-request (or equivalent privileged-context-executes-PR-code) vulnerability. It must explicitly connect the privileged trigger (pull_request_target, workflow_run, or similar) to the checkout/execution/import/load of attacker-controlled PR code AND note the presence of secrets or write-scoped tokens in that context. A generic 'pin your actions' or 'use least privilege' note without naming the pwn-request shape does not satisfy the rubric.");
});

describeEval(
  "report-pwn-request",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-pwn-request__pr-target-checkout-build",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-pwn-request");
        const result = await run("Please audit this workflow for security issues:\n\n```yaml\nname: PR Build\non:\n  pull_request_target:\n    types: [opened, synchronize]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: npm ci\n      - run: npm run build\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n          AWS_ACCESS_KEY_ID: ${{ secrets.AWS_ACCESS_KEY_ID }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("pull_request_target", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(PwnRequestJudge);
      },
    );

    it(
      "report-pwn-request__workflow-run-downloads-pr-artifact",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-pwn-request");
        const result = await run("Is there anything wrong with this workflow?\n\n```yaml\nname: Post-CI\non:\n  workflow_run:\n    workflows: [\"CI\"]\n    types: [completed]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/download-artifact@v4\n        with:\n          name: build-output\n          run-id: ${{ github.event.workflow_run.id }}\n          github-token: ${{ secrets.GITHUB_TOKEN }}\n      - run: node ./dist/index.js\n        env:\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("workflow_run", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(PwnRequestJudge);
      },
    );

    it(
      "report-pwn-request__pr-target-imports-pr-config",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-pwn-request");
        const result = await run("Review this workflow please:\n\n```yaml\nname: Lint PR\non:\n  pull_request_target:\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n      pull-requests: write\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm install\n      - run: npx eslint .\n        env:\n          GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}\n          SONAR_TOKEN: ${{ secrets.SONAR_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("pull_request_target", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(PwnRequestJudge);
      },
    );
  },
);
