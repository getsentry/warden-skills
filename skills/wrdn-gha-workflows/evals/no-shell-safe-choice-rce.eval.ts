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
  ExplainsChoiceConstraintJudge,
  RecognizesNoShellSafeChoiceRceJudge,
  RecommendsHardeningOnlyJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-shell-safe-choice-rce",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-shell-safe-choice-rce__safe-choice-in-run",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-shell-safe-choice-rce");
        await harness.useFixture("no-shell-safe-choice-rce__safe-choice-in-run");
        const result = await run("Audit .github/workflows/deploy.yml — is the use of inputs.environment in the run step a command injection / RCE risk?");

        await expect(result).toSatisfyJudge(RecognizesNoShellSafeChoiceRceJudge);
        await expect(result).toSatisfyJudge(RecommendsHardeningOnlyJudge);
        await expect(result).toSatisfyJudge(ExplainsChoiceConstraintJudge);
      },
    );
  },
);
