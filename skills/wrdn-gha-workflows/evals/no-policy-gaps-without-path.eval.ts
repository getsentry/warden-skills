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

const NoPolicyGapFindingJudge = judge("NoPolicyGapFindingJudge", async ({ criterion }) => {
  return criterion("Does NOT report missing branch protections, required reviewers, CODEOWNERS, or org policy gaps as a finding for this workflow.");
});

const FocusesOnWorkflowContentJudge = judge("FocusesOnWorkflowContentJudge", async ({ criterion }) => {
  return criterion("Response focuses on the workflow's actual content (or confirms no exploitable path) rather than recommending repository governance controls.");
});

describeEval(
  "no-policy-gaps-without-path",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-policy-gaps-without-path__safe-ci-no-protections",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-policy-gaps-without-path");
        await harness.setup("mkdir -p .github/workflows\ncat > .github/workflows/ci.yml <<'YAML'\nname: CI\non:\n  pull_request:\njobs:\n  test:\n    runs-on: ubuntu-latest\n    permissions:\n      contents: read\n    steps:\n      - uses: actions/checkout@v4\n      - run: npm ci && npm test\nYAML");
        const result = await run("Audit .github/workflows/ci.yml. Note that this repo has no branch protection rules and no CODEOWNERS file.");

        await expect(result).toSatisfyJudge(NoPolicyGapFindingJudge);
        await expect(result).toSatisfyJudge(FocusesOnWorkflowContentJudge);
      },
    );
  },
);
