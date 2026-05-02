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
  "no-public-only-mutable-refs",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-public-only-mutable-refs__public-readonly-third-party",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-public-only-mutable-refs");
        await harness.setup("mkdir -p .github/workflows && cat > .github/workflows/build.yml <<'YAML'\nname: build\non:\n  push:\n    branches: [main]\npermissions:\n  contents: read\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - uses: docker/setup-buildx-action@v3\n      - run: echo \"building public docs\"\nYAML\n");
        const result = await run("Please audit .github/workflows/build.yml for security issues. Report any real findings.");

        expect(result.session.outputText).not.toContain("docker/setup-buildx-action@v3");
        expect(result.session.outputText).not.toContain("mutable ref");
        expect(result.session.outputText).not.toContain("pin to a full SHA");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+findings?|no\\s+issues?|nothing\\s+exploitable|out\\s+of\\s+scope|no\\s+real\\s+security)", "i"));
      },
    );

    it(
      "no-public-only-mutable-refs__first-party-tag-refs",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-public-only-mutable-refs");
        await harness.setup("mkdir -p .github/workflows && cat > .github/workflows/ci.yml <<'YAML'\nname: ci\non: [push]\npermissions:\n  contents: read\njobs:\n  test:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n      - uses: github/codeql-action/init@v3\n      - run: python -m pytest\nYAML\n");
        const result = await run("Audit this workflow and report any unpinned action references.");

        expect(result.session.outputText).not.toContain("actions/checkout@v4");
        expect(result.session.outputText).not.toContain("actions/setup-python@v5");
        expect(result.session.outputText).not.toContain("github/codeql-action");
        expect(result.session.outputText).toMatch(new RegExp("(no\\s+findings?|first[- ]party|out\\s+of\\s+scope|no\\s+real\\s+security)", "i"));
      },
    );
  },
);
