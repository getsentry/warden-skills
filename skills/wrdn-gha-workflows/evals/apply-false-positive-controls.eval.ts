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
  DistinguishesPrivilegedTriggerJudge,
  DoesNotFlagSafeWorkflowJudge,
  ExplainsFalsePositiveTrapJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "apply-false-positive-controls",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "apply-false-positive-controls__default-checkout-pr-target",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__default-checkout-pr-target");
        const result = await run("Audit .github/workflows/label.yml for security issues. Is this a pwn-request vulnerability?");

        await expect(result).toSatisfyJudge(DistinguishesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagSafeWorkflowJudge);
        await expect(result).toSatisfyJudge(ExplainsFalsePositiveTrapJudge);
      },
    );

    it(
      "apply-false-positive-controls__hardcoded-choice-input",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__hardcoded-choice-input");
        const result = await run("Review this workflow. Does the choice input create an RCE?");

        await expect(result).toSatisfyJudge(DoesNotFlagSafeWorkflowJudge);
        await expect(result).toSatisfyJudge(ExplainsFalsePositiveTrapJudge);
      },
    );
  },
);
