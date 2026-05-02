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

const ExpressionInjectionJudge = judge("ExpressionInjectionJudge", async ({ criterion }) => {
  return criterion("Explains that the GitHub expression is interpolated into a code-evaluating sink (shell/script body) and that the source is attacker-controllable, enabling code execution.");
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
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/greet.yml <<'YAML'\nname: greet\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Echo PR title\n        run: |\n          echo \"New PR: ${{ github.event.pull_request.title }}\"\nYAML\n");
        const result = await run("Audit .github/workflows/greet.yml for injection issues and report any findings with severity.");

        expect(result.session.outputText).toContain("github.event.pull_request.title");
        expect(result.session.outputText).toMatch(new RegExp("\\brun\\b", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL|MEDIUM)\\b"));
        await expect(result).toSatisfyJudge(ExpressionInjectionJudge);
      },
    );

    it(
      "report-expression-injection__github-script-comment-body",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-expression-injection");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/triage.yml <<'YAML'\nname: triage\non:\n  issue_comment:\n    types: [created]\njobs:\n  triage:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/github-script@v7\n        with:\n          script: |\n            const body = `${{ github.event.comment.body }}`;\n            console.log(body);\nYAML\n");
        const result = await run("Review .github/workflows/triage.yml. Are there any expression injection sinks?");

        expect(result.session.outputText).toContain("github.event.comment.body");
        expect(result.session.outputText).toContain("github-script");
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL|MEDIUM)\\b"));
        await expect(result).toSatisfyJudge(ExpressionInjectionJudge);
      },
    );

    it(
      "report-expression-injection__github-env-write-branch-name",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-expression-injection");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\nname: build\non:\n  pull_request_target:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Set branch\n        run: |\n          echo \"BRANCH=${{ github.head_ref }}\" >> $GITHUB_ENV\n      - run: ./build.sh\nYAML\n");
        const result = await run("Check .github/workflows/build.yml for any unsafe interpolation into environment files.");

        expect(result.session.outputText).toContain("github.head_ref");
        expect(result.session.outputText).toMatch(new RegExp("\\$GITHUB_ENV"));
        expect(result.session.outputText).toMatch(new RegExp("\\b(HIGH|CRITICAL|MEDIUM)\\b"));
        await expect(result).toSatisfyJudge(ExpressionInjectionJudge);
      },
    );
  },
);
