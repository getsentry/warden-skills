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
  DoesNotFlagPolicyGapJudge,
  ScopesReviewToWorkflowJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-policy-gaps-without-path",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-policy-gaps-without-path__safe-ci",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-policy-gaps-without-path");
        await harness.useFixture("no-policy-gaps-without-path__safe-ci");
        const result = await run("Please audit .github/workflows/ci.yml for security issues.");

        await expect(result).toSatisfyJudge(DoesNotFlagPolicyGapJudge);
        await expect(result).toSatisfyJudge(ScopesReviewToWorkflowJudge);
      },
    );
  },
);
