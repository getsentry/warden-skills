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
  return criterion("The response identifies expression injection: it names the attacker-controlled GitHub context (e.g., pull_request title/body, comment body, branch name, commit message) and explains that interpolating ${{ ... }} directly into a code-evaluating sink (run:, github-script, -c/-e flag, or $GITHUB_ENV/$GITHUB_OUTPUT/$GITHUB_PATH/$GITHUB_STEP_SUMMARY write) causes the expansion to be evaluated as code. A generic 'quote your variables' or 'pin actions' note without naming the sink and the controlled source does not satisfy the rubric.");
});

describeEval(
  "report-expression-injection",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-expression-injection__pr-title-in-run",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-expression-injection");
        const result = await run("Can you audit this workflow for security issues?\n\n```yaml\nname: PR Greeter\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  greet:\n    runs-on: ubuntu-latest\n    steps:\n      - run: echo \"New PR: ${{ github.event.pull_request.title }}\"\n      - run: |\n          curl -X POST -H \"Authorization: Bearer ${{ secrets.SLACK_TOKEN }}\" \\\n            -d \"text=${{ github.event.pull_request.body }}\" \\\n            https://hooks.slack.example/notify\n```");

        expect(result.session.outputText).toMatch(new RegExp("(expression injection|script injection|command injection)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("pull_request\\.(title|body)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("\\brun:?\\b", "i"));
        await expect(result).toSatisfyJudge(ExpressionInjectionJudge);
      },
    );

    it(
      "report-expression-injection__github-script-comment-body",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-expression-injection");
        const result = await run("Please review this for any security concerns:\n\n```yaml\nname: Comment Handler\non:\n  issue_comment:\n    types: [created]\njobs:\n  handle:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: write\n      issues: write\n    steps:\n      - uses: actions/github-script@v7\n        with:\n          script: |\n            const body = `${{ github.event.comment.body }}`;\n            if (body.includes('/deploy')) {\n              core.setOutput('deploy', 'true');\n            }\n```");

        expect(result.session.outputText).toMatch(new RegExp("(expression injection|script injection)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(github-script|actions/github-script)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("comment\\.body", "i"));
        await expect(result).toSatisfyJudge(ExpressionInjectionJudge);
      },
    );

    it(
      "report-expression-injection__branch-name-to-github-env",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("report-expression-injection");
        const result = await run("Anything wrong with this build workflow?\n\n```yaml\nname: Build\non:\n  pull_request_target:\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - run: |\n          echo \"BRANCH=${{ github.head_ref }}\" >> $GITHUB_ENV\n      - run: ./build.sh\n        env:\n          DEPLOY_KEY: ${{ secrets.DEPLOY_KEY }}\n```");

        expect(result.session.outputText).toMatch(new RegExp("(expression injection|script injection|command injection)", "i"));
        expect(result.session.outputText).toMatch(new RegExp("(GITHUB_ENV|head_ref)", "i"));
        await expect(result).toSatisfyJudge(ExpressionInjectionJudge);
      },
    );
  },
);
