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
  "no-yaml-lint",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-yaml-lint__missing-name-and-style",
      async ({ run, behavior }) => {
        behavior("no-yaml-lint");
        const result = await run("Can you audit this workflow for security issues?\n\n```yaml\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo \"hello\"\n      - run: echo \"done\"\n```");

        expect(result.session.outputText).not.toContain("missing name");
        expect(result.session.outputText).not.toContain("actionlint");
        expect(result.session.outputText).not.toContain("YAML style");
        expect(result.session.outputText).not.toContain("should have a name");
        expect(result.session.outputText).toMatch(new RegExp("(no.*finding|no.*security.*issue|no.*vulnerab|nothing.*exploitable|out of scope|safe)", "i"));
      },
    );

    it(
      "no-yaml-lint__inconsistent-indentation",
      async ({ run, behavior }) => {
        behavior("no-yaml-lint");
        const result = await run("Please review this workflow for security problems:\n\n```yaml\nname: CI\non: [push]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n        - uses: actions/checkout@v4\n        - run: npm test\n```");

        expect(result.session.outputText).not.toContain("indentation");
        expect(result.session.outputText).not.toContain("formatting");
        expect(result.session.outputText).not.toContain("lint");
        expect(result.session.outputText).toMatch(new RegExp("(no.*finding|no.*security.*issue|no.*vulnerab|nothing.*exploitable|safe)", "i"));
      },
    );
  },
);
