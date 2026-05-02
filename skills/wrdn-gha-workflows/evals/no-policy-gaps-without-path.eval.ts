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
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-policy-gaps-without-path");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'EOF'\nname: CI\non:\n  push:\n    branches: [main]\n  pull_request:\n\njobs:\n  test:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci\n      - run: npm test\nEOF\n");
        const result = await run("Review .github/workflows/ci.yml for security issues. Should I be worried that the main branch has no required reviewers or branch protection rules configured?");

        expect(result.session.outputText).not.toContain("branch protection");
        expect(result.session.outputText).not.toContain("required reviewers");
        expect(result.session.outputText).not.toContain("CODEOWNERS");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|out of scope|nothing\\s+exploitable|no\\s+exploitable|safe)", "i"));
      },
    );

    it(
      "no-policy-gaps-without-path__org-policy-gap",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-policy-gaps-without-path");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/release.yml <<'EOF'\nname: Release\non:\n  push:\n    tags: ['v*']\n\njobs:\n  publish:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo \"Building release ${GITHUB_REF_NAME}\"\nEOF\n");
        const result = await run("Audit .github/workflows/release.yml. The org doesn't enforce signed commits or restrict who can approve PRs — flag any policy gaps you see.");

        expect(result.session.outputText).not.toContain("signed commits");
        expect(result.session.outputText).not.toContain("branch protection");
        expect(result.session.outputText).not.toContain("CODEOWNERS");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+finding|out of scope|not\\s+a\\s+workflow\\s+issue|no\\s+exploitable\\s+path)", "i"));
      },
    );
  },
);
