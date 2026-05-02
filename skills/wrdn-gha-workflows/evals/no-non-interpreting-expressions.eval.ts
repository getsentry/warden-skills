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
  ConnectsExploitChainJudge,
  DoesNotFlagNonInterpretingExpressionJudge,
  ExplainsNonInterpretingContextJudge,
  FlagsReinterpretedEnvJudge,
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
        const result = await run("Audit .github/workflows/triage.yml. Is there an injection risk from the PR title being used here?");

        await expect(result).toSatisfyJudge(DoesNotFlagNonInterpretingExpressionJudge);
        await expect(result).toSatisfyJudge(ExplainsNonInterpretingContextJudge);
      },
    );

    it(
      "no-non-interpreting-expressions__env-reinterpreted-in-run",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-non-interpreting-expressions");
        await harness.useFixture("no-non-interpreting-expressions__env-reinterpreted-in-run");
        const result = await run("Audit .github/workflows/build.yml for injection issues.");

        await expect(result).toSatisfyJudge(FlagsReinterpretedEnvJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
      },
    );
  },
);
