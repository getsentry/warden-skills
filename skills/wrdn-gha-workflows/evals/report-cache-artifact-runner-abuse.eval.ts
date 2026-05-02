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

const CacheRunnerAbuseJudge = judge("CacheRunnerAbuseJudge", async ({ criterion }) => {
  return criterion("Explains how attacker-controlled cache/artifact contents (or self-hosted runner reuse) reach a privileged job that executes or trusts them, including the eviction-replace mechanic when relevant.");
});

describeEval(
  "report-cache-artifact-runner-abuse",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-cache-artifact-runner-abuse__cache-poisoning-pr",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-cache-artifact-runner-abuse");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: ci\non:\n  pull_request:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/cache@v4\n        with:\n          path: node_modules\n          key: deps-${{ hashFiles('package-lock.json') }}\n      - run: npm ci\n      - run: npm run build\n  release:\n    needs: build\n    if: github.ref == 'refs/heads/main'\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/cache@v4\n        with:\n          path: node_modules\n          key: deps-${{ hashFiles('package-lock.json') }}\n      - run: npm run release\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\nYAML\n");
        const result = await run("Please audit .github/workflows/ci.yml for supply-chain risks. Focus on the cache and how it interacts with the release job.");

        expect(result.session.outputText).toContain("cache");
        expect(result.session.outputText).toMatch(new RegExp("\\b(poison|poisoning|attacker-controlled)\\b", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).toContain("NPM_TOKEN");
        await expect(result).toSatisfyJudge(CacheRunnerAbuseJudge);
      },
    );

    it(
      "report-cache-artifact-runner-abuse__self-hosted-pr-runner",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-cache-artifact-runner-abuse");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/test.yml <<'YAML'\nname: test\non:\n  pull_request:\njobs:\n  test:\n    runs-on: [self-hosted, linux, x64]\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: npm install\n      - run: npm test\nYAML\n");
        const result = await run("Review .github/workflows/test.yml — anything dangerous about the runner choice for PRs?");

        expect(result.session.outputText).toContain("self-hosted");
        expect(result.session.outputText).toMatch(new RegExp("\\b(persistent|non-ephemeral|reused|sensitive)\\b", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(CacheRunnerAbuseJudge);
      },
    );

    it(
      "report-cache-artifact-runner-abuse__artifact-into-privileged",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-cache-artifact-runner-abuse");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\nname: build\non:\n  pull_request:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.event.pull_request.head.sha }}\n      - run: npm run build\n      - uses: actions/upload-artifact@v4\n        with:\n          name: dist\n          path: dist/\nYAML\ncat > .github/workflows/publish.yml <<'YAML'\nname: publish\non:\n  workflow_run:\n    workflows: [build]\n    types: [completed]\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/download-artifact@v4\n        with:\n          name: dist\n      - run: node dist/index.js\n        env:\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\nYAML\n");
        const result = await run("Audit these two workflows. The first runs on PRs and uploads a build artifact; the second runs on workflow_run and publishes. Anything to worry about?");

        expect(result.session.outputText).toContain("artifact");
        expect(result.session.outputText).toContain("workflow_run");
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        expect(result.session.outputText).toContain("DEPLOY_KEY");
        await expect(result).toSatisfyJudge(CacheRunnerAbuseJudge);
      },
    );
  },
);
