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
      "no-public-only-mutable-refs__public-readonly-mutable-tag",
      async ({ run, behavior }) => {
        behavior("no-public-only-mutable-refs");
        const result = await run("Anything risky in this workflow? It just publishes a public docs site preview from the main branch.\n\n```yaml\nname: Docs Preview\non:\n  push:\n    branches: [main]\njobs:\n  preview:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: 20\n      - uses: peaceiris/actions-gh-pages@v3\n        with:\n          github_token: ${{ secrets.GITHUB_TOKEN }}\n          publish_dir: ./public\n```\n\nNote: GITHUB_TOKEN here is the default read-only token (no permissions block elevates it beyond contents: read). No other secrets, no OIDC.");

        expect(result.session.outputText).not.toContain("pin");
        expect(result.session.outputText).not.toContain("mutable");
        expect(result.session.outputText).not.toContain("supply chain");
        expect(result.session.outputText).toMatch(new RegExp("(no findings?|no issues?|safe|out of scope|nothing.*(risky|exploit))", "i"));
      },
    );

    it(
      "no-public-only-mutable-refs__first-party-actions-tag",
      async ({ run, behavior }) => {
        behavior("no-public-only-mutable-refs");
        const result = await run("Please audit:\n\n```yaml\nname: CI\non: [pull_request]\njobs:\n  test:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-python@v5\n        with:\n          python-version: '3.12'\n      - uses: github/codeql-action/init@v3\n      - run: pytest\n```");

        expect(result.session.outputText).not.toContain("pin");
        expect(result.session.outputText).not.toContain("SHA");
        expect(result.session.outputText).not.toContain("mutable");
        expect(result.session.outputText).toMatch(new RegExp("(no findings?|no issues?|safe|out of scope|nothing.*(risky|exploit))", "i"));
      },
    );
  },
);
