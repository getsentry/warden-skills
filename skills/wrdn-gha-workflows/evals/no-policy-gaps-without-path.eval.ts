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
  "no-policy-gaps-without-path",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-policy-gaps-without-path__missing-branch-protection",
      async ({ run, behavior }) => {
        behavior("no-policy-gaps-without-path");
        const result = await run("Audit this workflow for security issues:\n\n```yaml\nname: CI\non:\n  push:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\n```\n\nNote: this repo doesn't have branch protection rules or CODEOWNERS configured.");

        expect(result.session.outputText).not.toContain("branch protection");
        expect(result.session.outputText).not.toContain("CODEOWNERS");
        expect(result.session.outputText).not.toContain("required reviewers");
        expect(result.session.outputText).toMatch(new RegExp("(no.*finding|no.*issue|out of scope|nothing.*exploit|no.*vulnerab)", "i"));
      },
    );

    it(
      "no-policy-gaps-without-path__no-org-policy-recommendations",
      async ({ run, behavior }) => {
        behavior("no-policy-gaps-without-path");
        const result = await run("Please review:\n\n```yaml\nname: Lint\non: [push]\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm run lint\n```");

        expect(result.session.outputText).not.toContain("organization policy");
        expect(result.session.outputText).not.toContain("branch protection");
        expect(result.session.outputText).not.toContain("required review");
        expect(result.session.outputText).not.toContain("CODEOWNERS");
      },
    );
  },
);
