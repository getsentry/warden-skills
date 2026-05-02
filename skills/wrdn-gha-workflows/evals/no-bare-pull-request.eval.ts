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
  "no-bare-pull-request",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-bare-pull-request__readonly-test-runner",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-bare-pull-request");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request:\n    branches: [main]\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - run: npm ci\n      - run: npm test\nYAML\n");
        const result = await run("Please review .github/workflows/ci.yml for any GitHub Actions security issues.");

        expect(result.session.outputText).not.toContain("pwn request");
        expect(result.session.outputText).not.toContain("pwn-request");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("CRITICAL");
        expect(result.session.outputText).not.toContain("HIGH");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+vulnerab|out of scope|safe|no\\s+issues)", "i"));
      },
    );

    it(
      "no-bare-pull-request__lint-only-no-secrets",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-bare-pull-request");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/lint.yml <<'YAML'\nname: Lint\non: pull_request\n\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with:\n          python-version: '3.12'\n      - run: pip install ruff\n      - run: ruff check .\nYAML\n");
        const result = await run("Audit this workflow for any privilege escalation or code execution risks.");

        expect(result.session.outputText).not.toContain("privilege escalation");
        expect(result.session.outputText).not.toContain("secret exfiltration");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|not\\s+exploitab|out of scope|safe|read-only)", "i"));
      },
    );
  },
);
