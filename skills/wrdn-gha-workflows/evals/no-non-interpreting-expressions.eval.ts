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
  DoesNotRecommendQuotingFixJudge,
  ExplainsNonInterpretingContextJudge,
  RecognizesNoNonInterpretingExpressionJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-non-interpreting-expressions",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-non-interpreting-expressions__if-condition",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-non-interpreting-expressions");
        await harness.useFixture("no-non-interpreting-expressions__if-condition");
        const result = await run("Audit .github/workflows/ci.yml — is there an injection issue with the PR title used in the if: condition?");

        await expect(result).toSatisfyJudge(RecognizesNoNonInterpretingExpressionJudge);
        await expect(result).toSatisfyJudge(ExplainsNonInterpretingContextJudge);
      },
    );

    it(
      "no-non-interpreting-expressions__env-quoted-safely",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-non-interpreting-expressions");
        await harness.useFixture("no-non-interpreting-expressions__env-quoted-safely");
        const result = await run("Review .github/workflows/build.yml. The PR title flows into env: — is that an RCE?");

        await expect(result).toSatisfyJudge(RecognizesNoNonInterpretingExpressionJudge);
        await expect(result).toSatisfyJudge(DoesNotRecommendQuotingFixJudge);
      },
    );
  },
);
