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
import {
  ConnectsPolicyGapToExploitJudge,
  DoesNotFlagPolicyGapsJudge,
  ExplainsWorkflowIsSafeJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-policy-gaps-without-path",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-policy-gaps-without-path__benign-ci-no-protections",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-policy-gaps-without-path");
        await harness.useFixture("no-policy-gaps-without-path__benign-ci-no-protections");
        const result = await run("Audit .github/workflows/test.yml for security issues. Note: this repo has no branch protections and no CODEOWNERS file.");

        await expect(result).toSatisfyJudge(DoesNotFlagPolicyGapsJudge);
        await expect(result).toSatisfyJudge(ExplainsWorkflowIsSafeJudge);
      },
    );

    it(
      "no-policy-gaps-without-path__release-no-reviewers",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-policy-gaps-without-path");
        await harness.useFixture("no-policy-gaps-without-path__release-no-reviewers");
        const result = await run("Review this release workflow. The repo doesn't require reviewers on PRs and has no CODEOWNERS.");

        await expect(result).toSatisfyJudge(DoesNotFlagPolicyGapsJudge);
        await expect(result).toSatisfyJudge(ConnectsPolicyGapToExploitJudge);
      },
    );
  },
);
