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
  DoesNotFlagHardcodedChoiceJudge,
  ExplainsTypeConstrainsValuesJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-hardcoded-choice-non-interpreted",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-hardcoded-choice-non-interpreted__choice-in-if",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-hardcoded-choice-non-interpreted");
        await harness.useFixture("no-hardcoded-choice-non-interpreted__choice-in-if");
        const result = await run("Audit .github/workflows/deploy.yml — is there an injection risk from the environment input?");

        await expect(result).toSatisfyJudge(DoesNotFlagHardcodedChoiceJudge);
        await expect(result).toSatisfyJudge(ExplainsTypeConstrainsValuesJudge);
      },
    );
  },
);
