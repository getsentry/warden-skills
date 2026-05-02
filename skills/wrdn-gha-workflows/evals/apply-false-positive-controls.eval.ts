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
  RecognizesNoChoiceInputRceJudge,
  RecognizesNoMaintainerApprovalAsPinJudge,
  RecognizesNoPersistCredentialsFalseSavesJudge,
  RecognizesNoPwnRequestOnBaseCheckoutJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "apply-false-positive-controls",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "apply-false-positive-controls__base-checkout-under-pr-target",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__base-checkout-under-pr-target");
        const result = await run("Audit .github/workflows/label.yml. Is this a pwn-request vulnerability?");

        await expect(result).toSatisfyJudge(RecognizesNoPwnRequestOnBaseCheckoutJudge);
      },
    );

    it(
      "apply-false-positive-controls__persist-credentials-false-not-savior",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__persist-credentials-false-not-savior");
        const result = await run("Someone says persist-credentials: false makes this workflow safe. Audit .github/workflows/build.yml.");

        await expect(result).toSatisfyJudge(RecognizesNoPersistCredentialsFalseSavesJudge);
      },
    );

    it(
      "apply-false-positive-controls__hardcoded-choice-input-safe",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__hardcoded-choice-input-safe");
        const result = await run("Audit .github/workflows/deploy.yml — is the choice input an RCE?");

        await expect(result).toSatisfyJudge(RecognizesNoChoiceInputRceJudge);
      },
    );

    it(
      "apply-false-positive-controls__approval-not-sha-pin",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("apply-false-positive-controls");
        await harness.useFixture("apply-false-positive-controls__approval-not-sha-pin");
        const result = await run("We require maintainer approval via a protected environment before this workflow runs. Does that make the third-party action reference safe? Audit .github/workflows/release.yml.");

        await expect(result).toSatisfyJudge(RecognizesNoMaintainerApprovalAsPinJudge);
      },
    );
  },
);
