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
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-non-interpreting-expressions",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-non-interpreting-expressions__if-condition",
      async ({ run, behavior }) => {
        behavior("no-non-interpreting-expressions");
        const result = await run("Is there an injection risk in this workflow's if: expression?\n\n```yaml\nname: Conditional Build\non: pull_request\njobs:\n  build:\n    runs-on: ubuntu-latest\n    if: ${{ github.event.pull_request.user.login == 'dependabot[bot]' }}\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo hello\n```");

        expect(result.session.outputText).not.toContain("injection vulnerability");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(safe|not.*vulnerab|no.*finding|out of scope|non-interpret|does not.*evaluat)", "i"));
      },
    );

    it(
      "no-non-interpreting-expressions__env-passed-to-action-with",
      async ({ run, behavior }) => {
        behavior("no-non-interpreting-expressions");
        const result = await run("Anything exploitable about passing the PR title into an action's `with:` here?\n\n```yaml\nname: Label\non: pull_request_target\njobs:\n  label:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/labeler@v5\n        with:\n          pr-title: ${{ github.event.pull_request.title }}\n          repo-token: ${{ secrets.GITHUB_TOKEN }}\n```");

        expect(result.session.outputText).not.toContain("command injection");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(safe|not.*vulnerab|no.*finding|non-interpret|does not.*reinterpret|no evidence)", "i"));
      },
    );
  },
);
