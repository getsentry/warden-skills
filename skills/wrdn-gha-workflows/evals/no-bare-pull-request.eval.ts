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
  judge,
  skilletHarness,
} from "@sentry/skillet/evals";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

const NoFalsePositiveOnBarePRJudge = judge("NoFalsePositiveOnBarePRJudge", async ({ criterion }) => {
  return criterion("Does NOT flag the plain pull_request workflow as a vulnerability, pwn-request, or injection risk; does not recommend switching triggers as if it were exploitable.");
});

const ExplainsReadOnlyTokenSafeJudge = judge("ExplainsReadOnlyTokenSafeJudge", async ({ criterion }) => {
  return criterion("Explains that pull_request gives a read-only GITHUB_TOKEN with no secrets exposed to the fork, so executing PR code in this isolated context is not a privilege-escalation path.");
});

describeEval(
  "no-bare-pull-request",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-bare-pull-request__plain-pr-build-test",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-bare-pull-request");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - uses: actions/setup-node@v4\n        with:\n          node-version: '20'\n      - run: npm ci\n      - run: npm test\n      - run: npm run lint\nYAML");
        const result = await run("Audit .github/workflows/ci.yml for security issues. Are there any vulnerabilities I should fix?");

        await expect(result).toSatisfyJudge(NoFalsePositiveOnBarePRJudge);
        await expect(result).toSatisfyJudge(ExplainsReadOnlyTokenSafeJudge);
      },
    );
  },
);
