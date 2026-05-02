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

const NoYamlLintFindingJudge = judge("NoYamlLintFindingJudge", async ({ criterion }) => {
  return criterion("Does NOT report missing 'name:' fields, formatting, or actionlint-style issues as security findings.");
});

const NoMetadataOnlyPrTargetJudge = judge("NoMetadataOnlyPrTargetJudge", async ({ criterion }) => {
  return criterion("Does NOT flag the pull_request_target workflow as vulnerable; recognizes it only labels/reads metadata without checking out PR code.");
});

const NoSafeResolvedValueJudge = judge("NoSafeResolvedValueJudge", async ({ criterion }) => {
  return criterion("Does NOT flag ${{ github.event.pull_request.number }} or full commit SHAs as injection sinks since they resolve to numeric IDs or fixed SHAs.");
});

const NoUnreachedSecretsJudge = judge("NoUnreachedSecretsJudge", async ({ criterion }) => {
  return criterion("Does NOT report secrets as vulnerable when they are used only in jobs that do not execute attacker-controlled code or artifacts.");
});

const NoPolicyGapWithoutPathJudge = judge("NoPolicyGapWithoutPathJudge", async ({ criterion }) => {
  return criterion("Does NOT report missing branch protection or CODEOWNERS as a finding when no exploitable workflow path is shown.");
});

describeEval(
  "exclude-non-findings",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "exclude-non-findings__yaml-style-only",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/lint.yml <<'YAML'\non:\n  push:\n    branches: [main]\njobs:\n  hello:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo hello\nYAML");
        const result = await run("Audit .github/workflows/lint.yml for security issues.");

        await expect(result).toSatisfyJudge(NoYamlLintFindingJudge);
      },
    );

    it(
      "exclude-non-findings__metadata-only-pr-target",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/label.yml <<'YAML'\nname: Label PR\non:\n  pull_request_target:\n    types: [opened]\npermissions:\n  pull-requests: write\njobs:\n  label:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/labeler@v5\n        with:\n          repo-token: ${{ secrets.GITHUB_TOKEN }}\nYAML");
        const result = await run("Audit .github/workflows/label.yml for security issues.");

        await expect(result).toSatisfyJudge(NoMetadataOnlyPrTargetJudge);
      },
    );

    it(
      "exclude-non-findings__safe-resolved-numeric-id",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/comment.yml <<'YAML'\nname: Comment\non: pull_request\njobs:\n  note:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \"PR number is ${{ github.event.pull_request.number }}\"\nYAML");
        const result = await run("Is there an injection risk in this workflow's use of ${{ github.event.pull_request.number }}?");

        await expect(result).toSatisfyJudge(NoSafeResolvedValueJudge);
      },
    );

    it(
      "exclude-non-findings__unreached-secrets",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/deploy.yml <<'YAML'\nname: Deploy\non:\n  push:\n    branches: [main]\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n        with:\n          ref: ${{ github.sha }}\n      - run: ./deploy.sh\n        env:\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\nYAML");
        const result = await run("Audit .github/workflows/deploy.yml for any security issues.");

        await expect(result).toSatisfyJudge(NoUnreachedSecretsJudge);
      },
    );

    it(
      "exclude-non-findings__policy-gap-without-path",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/test.yml <<'YAML'\nname: Test\non: pull_request\njobs:\n  test:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\nYAML");
        const result = await run("Audit .github/workflows/test.yml — note we have no CODEOWNERS file and main branch has no required reviewers.");

        await expect(result).toSatisfyJudge(NoPolicyGapWithoutPathJudge);
      },
    );
  },
);
