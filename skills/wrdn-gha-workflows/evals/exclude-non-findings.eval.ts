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
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/labeler.yml <<'YAML'\nname: PR Labeler\non:\n  pull_request_target:\n    types: [opened, reopened]\n\npermissions:\n  pull-requests: write\n\njobs:\n  label:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/labeler@v5\nYAML\n");
        const result = await run("Audit .github/workflows/labeler.yml for GitHub Actions security issues. Report only real exploitable findings.");

        expect(result.session.outputText).not.toContain("pwn request");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+findings?|out of scope|not\\s+exploitable|metadata[-\\s]only|no\\s+exploitable)", "i"));
      },
    );

    it(
      "exclude-non-findings__numeric-id-expression",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non: [pull_request]\n\npermissions:\n  contents: read\n\njobs:\n  echo:\n    runs-on: ubuntu-latest\n    steps:\n      - name: Print PR number\n        env:\n          PR_NUM: ${{ github.event.pull_request.number }}\n        run: echo \"PR is $PR_NUM\"\nYAML\n");
        const result = await run("Review .github/workflows/ci.yml — is there any injection risk from the ${{ github.event.pull_request.number }} usage?");

        expect(result.session.outputText).not.toContain("injection");
        expect(result.session.outputText).not.toContain("RCE");
        expect(result.session.outputText).toMatch(new RegExp("(numeric|integer|safe|no\\s+findings?|not\\s+exploitable)", "i"));
      },
    );

    it(
      "exclude-non-findings__actionlint-style",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\non: push\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci && npm run build\nYAML\n");
        const result = await run("Security review of .github/workflows/build.yml please.");

        expect(result.session.outputText).not.toContain("actionlint");
        expect(result.session.outputText).not.toContain("missing name");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+findings?|no\\s+exploitable|out of scope)", "i"));
      },
    );
  },
);
