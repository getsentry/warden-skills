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
  return criterion("The response identifies the specific abuse pattern (cache poisoning via attacker-controlled key/contents, 10 GiB eviction-and-replace, or self-hosted runner exposure to untrusted code) and explains the exploit chain: how attacker-controlled data reaches a privileged job that executes or trusts it. A generic 'pin actions' or 'use ephemeral runners' note without tying to this workflow's chain does not satisfy the rubric.");
});

describeEval(
  "report-cache-artifact-runner-abuse",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-cache-artifact-runner-abuse__cache-poisoning-pr",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-cache-artifact-runner-abuse");
        const result = await run("Review this pair of workflows for security issues:\n\n```yaml\n# .github/workflows/pr-build.yml\nname: PR Build\non: pull_request\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/cache@v4\n        with:\n          path: node_modules\n          key: deps-${{ github.ref }}-${{ hashFiles('package-lock.json') }}\n      - run: npm ci\n      - run: npm run build\n```\n\n```yaml\n# .github/workflows/release.yml\nname: Release\non:\n  push:\n    branches: [main]\njobs:\n  release:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/cache@v4\n        with:\n          path: node_modules\n          key: deps-refs/heads/main-${{ hashFiles('package-lock.json') }}\n      - run: npm run build\n      - run: npm publish\n        env:\n          NPM_TOKEN: ${{ secrets.NPM_TOKEN }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("cache", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(poison|attacker-controlled|untrusted)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(CacheRunnerAbuseJudge);
      },
    );

    it(
      "report-cache-artifact-runner-abuse__self-hosted-runner-pr",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-cache-artifact-runner-abuse");
        const result = await run("Is this workflow safe?\n\n```yaml\nname: PR CI\non: pull_request\njobs:\n  test:\n    runs-on: [self-hosted, linux, persistent]\n    steps:\n      - uses: actions/checkout@v4\n      - run: make test\n```");

        expect(result.session.outputText).toMatch(new RegExp("self-hosted", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(persistent|ephemeral|untrusted|fork)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(CacheRunnerAbuseJudge);
      },
    );

    it(
      "report-cache-artifact-runner-abuse__artifact-restore-privileged",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-cache-artifact-runner-abuse");
        const result = await run("Two workflows in the same repo. Anything to worry about?\n\n```yaml\n# .github/workflows/pr.yml\nname: PR\non: pull_request\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm run build\n      - uses: actions/upload-artifact@v4\n        with:\n          name: dist\n          path: dist/\n```\n\n```yaml\n# .github/workflows/deploy.yml\nname: Deploy\non:\n  workflow_run:\n    workflows: [PR]\n    types: [completed]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      id-token: write\n    steps:\n      - uses: dawidd6/action-download-artifact@v3\n        with:\n          name: dist\n          run_id: ${{ github.event.workflow_run.id }}\n      - run: ./dist/deploy.sh\n        env:\n          AWS_ROLE: ${{ secrets.AWS_DEPLOY_ROLE }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("artifact", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(workflow_run|privileged|attacker-controlled)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL)\\b"));
        await expect(result).toSatisfyJudge(CacheRunnerAbuseJudge);
      },
    );
  },
);
