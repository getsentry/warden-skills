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
  "exclude-non-findings",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "exclude-non-findings__label-only-pr-target",
      async ({ run, behavior }) => {
        behavior("exclude-non-findings");
        const result = await run("Audit this workflow for GitHub Actions security issues:\n\n```yaml\nname: Auto-label PRs\non:\n  pull_request_target:\n    types: [opened]\njobs:\n  label:\n    runs-on: ubuntu-latest\n    permissions:\n      pull-requests: write\n    steps:\n      - uses: actions/labeler@v5\n        with:\n          repo-token: ${{ secrets.GITHUB_TOKEN }}\n```");

        expect(result.session.outputText).not.toContain("pwn");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(no findings|out of scope|no exploitable|metadata only|safe|not vulnerable)", "i"));
        expect(result.session.outputText).not.toContain("HIGH");
        expect(result.session.outputText).not.toContain("CRITICAL");
      },
    );

    it(
      "exclude-non-findings__numeric-id-and-sha",
      async ({ run, behavior }) => {
        behavior("exclude-non-findings");
        const result = await run("Are there injection risks in this step?\n\n```yaml\non: pull_request_target\njobs:\n  comment:\n    runs-on: ubuntu-latest\n    steps:\n      - run: |\n          echo \"PR #${{ github.event.pull_request.number }} at ${{ github.event.pull_request.head.sha }} on ${{ github.event.repository.default_branch }}\"\n```");

        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(safe|numeric|full SHA|no finding|out of scope|not vulnerable)", "i"));
      },
    );

    it(
      "exclude-non-findings__hardcoded-choice-input",
      async ({ run, behavior }) => {
        behavior("exclude-non-findings");
        const result = await run("Review this dispatch workflow for security issues:\n\n```yaml\non:\n  workflow_dispatch:\n    inputs:\n      env:\n        type: choice\n        options: [staging, production]\n      debug:\n        type: boolean\n        default: false\njobs:\n  deploy:\n    runs-on: ubuntu-latest\n    if: inputs.env == 'production'\n    steps:\n      - uses: actions/checkout@v4\n      - uses: some-deployer/action@v1\n        with:\n          target: ${{ inputs.env }}\n          verbose: ${{ inputs.debug }}\n```");

        expect(result.session.outputText).not.toContain("injection vulnerability");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(no finding|out of scope|safe|hardcoded|not exploitable|hardening)", "i"));
      },
    );

    it(
      "exclude-non-findings__yaml-style-only",
      async ({ run, behavior }) => {
        behavior("exclude-non-findings");
        const result = await run("Security review please:\n\n```yaml\non: push\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm test\n```\n\n(Note: missing top-level name, inconsistent indentation in some places.)");

        expect(result.session.outputText).not.toContain("missing name");
        expect(result.session.outputText).not.toContain("actionlint");
        expect(result.session.outputText).not.toContain("YAML style");
        expect(result.session.outputText).toMatch(new RegExp("(no finding|out of scope|no exploitable|not a security)", "i"));
      },
    );

    it(
      "exclude-non-findings__first-party-tag-ref",
      async ({ run, behavior }) => {
        behavior("exclude-non-findings");
        const result = await run("Any supply-chain risk in pinning here?\n\n```yaml\non: pull_request\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - run: npm ci && npm test\n```");

        expect(result.session.outputText).not.toContain("mutable ref");
        expect(result.session.outputText).not.toContain("pin to SHA");
        expect(result.session.outputText).toMatch(new RegExp("(no finding|out of scope|first-party|safe|not exploitable)", "i"));
      },
    );
  },
);
