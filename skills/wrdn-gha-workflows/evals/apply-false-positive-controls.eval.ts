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
  DistinguishesPersistCredentialsScopeJudge,
  DistinguishesPullRequestTargetCheckoutJudge,
  DoesNotFlagBarePullRequestJudge,
  DoesNotFlagChoiceInputJudge,
  ExplainsFalsePositiveTrapJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "apply-false-positive-controls",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "apply-false-positive-controls__pr-target-default-checkout",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__pr-target-default-checkout");
        const result = await run("Audit .github/workflows/label.yml. Is the checkout here a pwn-request?");

        await expect(result).toSatisfyJudge(DistinguishesPullRequestTargetCheckoutJudge);
        await expect(result).toSatisfyJudge(ExplainsFalsePositiveTrapJudge);
      },
    );

    it(
      "apply-false-positive-controls__choice-input-shell",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__choice-input-shell");
        const result = await run("Is this workflow_dispatch with a choice input vulnerable to command injection?");

        await expect(result).toSatisfyJudge(DoesNotFlagChoiceInputJudge);
        await expect(result).toSatisfyJudge(ExplainsFalsePositiveTrapJudge);
      },
    );

    it(
      "apply-false-positive-controls__persist-credentials-scope",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__persist-credentials-scope");
        const result = await run("We set persist-credentials: false on checkout. Does that mean our NPM_TOKEN env is also safe in the test step?");

        await expect(result).toSatisfyJudge(DistinguishesPersistCredentialsScopeJudge);
      },
    );

    it(
      "apply-false-positive-controls__bare-pull-request-no-secrets",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__bare-pull-request-no-secrets");
        const result = await run("Is this CI workflow a pwn-request risk?");

        await expect(result).toSatisfyJudge(DoesNotFlagBarePullRequestJudge);
        await expect(result).toSatisfyJudge(ExplainsFalsePositiveTrapJudge);
      },
    );
  },
);
