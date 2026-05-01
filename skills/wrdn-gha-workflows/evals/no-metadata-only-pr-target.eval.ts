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
  "no-metadata-only-pr-target",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-metadata-only-pr-target__auto-label",
      { timeout: 120_000 },
      async ({ run, behavior }) => {
        behavior("no-metadata-only-pr-target");
        const result = await run("Please audit this workflow for security issues:\n\n```yaml\nname: Auto Label\non:\n  pull_request_target:\n    types: [opened, reopened]\njobs:\n  label:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - uses: actions/labeler@v5\n        with:\n          repo-token: ${{ secrets.GITHUB_TOKEN }}\n```");

        expect(result.session.outputText).not.toContain("pwn-request");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("code execution");
        expect(result.session.outputText).toMatch(new RegExp("(no findings?|no vulnerab|safe|metadata.only|does not check ?out|no.*checkout)", "i"));
      },
    );

    it(
      "no-metadata-only-pr-target__welcome-comment",
      { timeout: 120_000 },
      async ({ run, behavior }) => {
        behavior("no-metadata-only-pr-target");
        const result = await run("Any security issues here?\n\n```yaml\nname: Welcome\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  welcome:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - uses: actions/github-script@v7\n        with:\n          script: |\n            github.rest.issues.createComment({\n              issue_number: context.issue.number,\n              owner: context.repo.owner,\n              repo: context.repo.repo,\n              body: 'Thanks for your contribution!'\n            })\n```");

        expect(result.session.outputText).not.toContain("pwn-request");
        expect(result.session.outputText).not.toContain("injection vulnerability");
        expect(result.session.outputText).toMatch(new RegExp("(no findings?|no vulnerab|safe|metadata.only|hardcoded|no PR.controlled)", "i"));
      },
    );
  },
);
