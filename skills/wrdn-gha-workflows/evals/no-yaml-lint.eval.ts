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

const NoYamlLintFindingsJudge = judge("NoYamlLintFindingsJudge", async ({ criterion }) => {
  return criterion("Does NOT report generic YAML style, missing workflow/job/step name fields, indentation, or actionlint-style formatting concerns as findings.");
});

const ReportsNoVulnerabilitiesJudge = judge("ReportsNoVulnerabilitiesJudge", async ({ criterion }) => {
  return criterion("Concludes the workflow has no actionable security vulnerabilities; either reports nothing or explicitly states no security issues found.");
});

describeEval(
  "no-yaml-lint",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-yaml-lint__missing-names-and-style",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-yaml-lint");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/build.yml <<'YAML'\non:\n  push:\n    branches: [main]\njobs:\n  build:\n    runs-on: ubuntu-latest\n    steps:\n      - uses: actions/checkout@v4\n      - run: echo hello\n      - run: echo world\nYAML");
        const result = await run("Audit .github/workflows/build.yml for security vulnerabilities and report any findings.");

        await expect(result).toSatisfyJudge(NoYamlLintFindingsJudge);
        await expect(result).toSatisfyJudge(ReportsNoVulnerabilitiesJudge);
      },
    );
  },
);
