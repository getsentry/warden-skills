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
  DoesNotFlagShellSafeChoiceAsRceJudge,
  ExplainsChoiceConstraintJudge,
  RecommendsEnvQuotingAsHardeningJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-shell-safe-choice-rce",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-shell-safe-choice-rce__choice-in-run-step",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-shell-safe-choice-rce");
        await harness.useFixture("no-shell-safe-choice-rce__choice-in-run-step");
        const result = await run("Audit .github/workflows/deploy.yml for security issues. Is the env input an RCE risk?");

        await expect(result).toSatisfyJudge(DoesNotFlagShellSafeChoiceAsRceJudge);
        await expect(result).toSatisfyJudge(ExplainsChoiceConstraintJudge);
        await expect(result).toSatisfyJudge(RecommendsEnvQuotingAsHardeningJudge);
      },
    );
  },
);
