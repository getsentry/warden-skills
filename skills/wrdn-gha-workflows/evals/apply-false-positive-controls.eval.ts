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
  DistinguishesApprovalFromSHAPinJudge,
  DistinguishesMaskingScopeJudge,
  DistinguishesPullRequestTargetCheckoutJudge,
  DoesNotFlagSafeTrapJudge,
  ExplainsPersistCredentialsScopeJudge,
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
        const result = await run("Audit .github/workflows/label.yml. Is the pull_request_target trigger here a pwn-request vulnerability?");

        await expect(result).toSatisfyJudge(DistinguishesPullRequestTargetCheckoutJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagSafeTrapJudge);
      },
    );

    it(
      "apply-false-positive-controls__persist-credentials-false-other-secrets",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__persist-credentials-false-other-secrets");
        const result = await run("Someone said this workflow is safe because persist-credentials is false. Is that right?");

        await expect(result).toSatisfyJudge(ExplainsPersistCredentialsScopeJudge);
      },
    );

    it(
      "apply-false-positive-controls__approval-is-not-sha-pin",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__approval-is-not-sha-pin");
        const result = await run("We require maintainer approval before workflows run on PRs. Does that make using third-party@v1 tag refs safe?");

        await expect(result).toSatisfyJudge(DistinguishesApprovalFromSHAPinJudge);
      },
    );

    it(
      "apply-false-positive-controls__masking-not-transformations",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__masking-not-transformations");
        const result = await run("GitHub masks secrets in logs, so this base64-encoding step is fine, right?");

        await expect(result).toSatisfyJudge(DistinguishesMaskingScopeJudge);
      },
    );
  },
);
