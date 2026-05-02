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

const IdentifiesAttackerControlledContextJudge = judge("IdentifiesAttackerControlledContextJudge", async ({ criterion }) => {
  return criterion("Names the specific attacker-controlled GitHub context (e.g. pull_request.title, comment body, branch name) being interpolated.");
});

const IdentifiesCodeEvaluatingSinkJudge = judge("IdentifiesCodeEvaluatingSinkJudge", async ({ criterion }) => {
  return criterion("Identifies the code-evaluating sink: a run: block, github-script body, interpreter -c/-e flag, or write to $GITHUB_ENV/$GITHUB_OUTPUT/$GITHUB_PATH/$GITHUB_STEP_SUMMARY.");
});

const ExplainsCodeExecutionJudge = judge("ExplainsCodeExecutionJudge", async ({ criterion }) => {
  return criterion("Explains that the expansion is evaluated as shell/JS code, allowing arbitrary command or code execution — not merely a quoting or formatting concern.");
});

describeEval(
  "report-expression-injection",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-expression-injection__pr-title-in-run",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-expression-injection");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/triage.yml <<'YAML'\nname: Triage\non:\n  pull_request_target:\n    types: [opened, edited]\njobs:\n  triage:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Log title\n        run: |\n          echo \"PR title: ${{ github.event.pull_request.title }}\"\n          echo \"Processing...\"\nYAML");
        const result = await run("Audit .github/workflows/triage.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesAttackerControlledContextJudge);
        await expect(result).toSatisfyJudge(IdentifiesCodeEvaluatingSinkJudge);
        await expect(result).toSatisfyJudge(ExplainsCodeExecutionJudge);
      },
    );

    it(
      "report-expression-injection__issue-comment-in-github-script",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-expression-injection");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/comment-bot.yml <<'YAML'\nname: Comment Bot\non:\n  issue_comment:\n    types: [created]\njobs:\n  respond:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/github-script@v7\n        with:\n          script: |\n            const body = `${{ github.event.comment.body }}`;\n            console.log(body);\nYAML");
        const result = await run("Review .github/workflows/comment-bot.yml — anything risky?");

        await expect(result).toSatisfyJudge(IdentifiesAttackerControlledContextJudge);
        await expect(result).toSatisfyJudge(IdentifiesCodeEvaluatingSinkJudge);
        await expect(result).toSatisfyJudge(ExplainsCodeExecutionJudge);
      },
    );

    it(
      "report-expression-injection__branch-name-to-github-env",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-expression-injection");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\nname: Build\non:\n  pull_request_target:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Set env\n        run: |\n          echo \"BRANCH=${{ github.head_ref }}\" >> $GITHUB_ENV\n      - name: Build\n        run: make build\n        env:\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\nYAML");
        const result = await run("Check .github/workflows/build.yml for injection risks.");

        await expect(result).toSatisfyJudge(IdentifiesAttackerControlledContextJudge);
        await expect(result).toSatisfyJudge(IdentifiesCodeEvaluatingSinkJudge);
        await expect(result).toSatisfyJudge(ExplainsCodeExecutionJudge);
      },
    );
  },
);
