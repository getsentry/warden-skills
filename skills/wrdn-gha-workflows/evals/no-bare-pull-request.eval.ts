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
      "no-bare-pull-request__plain-test-workflow",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("no-bare-pull-request");
        const result = await run("Audit this workflow for GitHub Actions security issues:\n\n```yaml\nname: CI\non:\n  pull_request:\n    branches: [main]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - run: npm ci\n      - run: npm test\n```");

        expect(result.session.outputText).not.toContain("pwn");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).not.toContain("privilege escalation");
        expect(result.session.outputText).toMatch(new RegExp("(no findings|no issues|safe|not vulnerable|read-only|no secrets|out of scope)", "i"));
      },
    );

    it(
      "no-bare-pull-request__lint-build-no-secrets",
      { timeout: 180_000 },
      async ({ run, behavior }) => {
        behavior("no-bare-pull-request");
        const result = await run("Any security concerns with this PR workflow?\n\n```yaml\nname: Lint\non: pull_request\njobs:\n  lint:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: |\n          echo \"PR title: ${{ github.event.pull_request.title }}\"\n          npm ci\n          npm run lint\n```");

        expect(result.session.outputText).not.toContain("pwn-request");
        expect(result.session.outputText).not.toContain("secrets exfil");
        expect(result.session.outputText).toMatch(new RegExp("(no.*(critical|high|exploit)|read-only|default token|no secrets|safe|not.*vulnerab)", "i"));
      },
    );
  },
);
