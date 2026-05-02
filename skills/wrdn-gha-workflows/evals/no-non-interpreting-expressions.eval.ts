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
  DoesNotFlagNonInterpretingExpressionJudge,
  DoesNotRecommendEnvQuotingAsFixJudge,
  ExplainsNonInterpretingContextJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-non-interpreting-expressions",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-non-interpreting-expressions__title-in-if-condition",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-non-interpreting-expressions");
        await harness.useFixture("no-non-interpreting-expressions__title-in-if-condition");
        const result = await run("Audit .github/workflows/triage.yml — is the use of github.event.pull_request.title in the if: condition a script injection vulnerability?");

        await expect(result).toSatisfyJudge(DoesNotFlagNonInterpretingExpressionJudge);
        await expect(result).toSatisfyJudge(ExplainsNonInterpretingContextJudge);
        await expect(result).toSatisfyJudge(DoesNotRecommendEnvQuotingAsFixJudge);
      },
    );

    it(
      "no-non-interpreting-expressions__title-in-with-input",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-non-interpreting-expressions");
        await harness.useFixture("no-non-interpreting-expressions__title-in-with-input");
        const result = await run("Review .github/workflows/notify.yml — does passing github.event.pull_request.title via with: to an action create a code injection risk?");

        await expect(result).toSatisfyJudge(DoesNotFlagNonInterpretingExpressionJudge);
        await expect(result).toSatisfyJudge(ExplainsNonInterpretingContextJudge);
        await expect(result).toSatisfyJudge(DoesNotRecommendEnvQuotingAsFixJudge);
      },
    );
  },
);
