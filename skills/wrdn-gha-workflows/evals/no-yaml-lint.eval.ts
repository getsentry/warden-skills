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
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-yaml-lint");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: |\n           echo \"hello\"\n           npm test\nYAML\n");
        const result = await run("Please audit .github/workflows/build.yml for security issues.");

        expect(result.session.outputText).not.toContain("actionlint");
        expect(result.session.outputText).not.toContain("missing name");
        expect(result.session.outputText).not.toContain("YAML style");
        expect(result.session.outputText).not.toContain("indentation");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+(security\\s+)?finding|nothing\\s+exploitable|out of scope|no\\s+actionable|safe)", "i"));
      },
    );

    it(
      "no-yaml-lint__explicit-lint-request",
      { timeout: 90_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-yaml-lint");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/release.yml <<'YAML'\non:\n  push:\n    tags: ['v*']\njobs:\n  release:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: ./scripts/release.sh\nYAML\n");
        const result = await run("Lint .github/workflows/release.yml and tell me about formatting problems, missing job names, or any actionlint warnings.");

        expect(result.session.outputText).not.toContain("actionlint");
        expect(result.session.outputText).not.toContain("formatting");
        expect(result.session.outputText).not.toContain("missing name");
        expect(result.session.outputText).toMatch(new RegExp("(out of scope|not\\s+a\\s+security|no\\s+(security\\s+)?finding|focus\\s+on\\s+security)", "i"));
      },
    );
  },
);
