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
  DoesNotFlagSafeResolvedValueJudge,
  ExplainsSafeResolvedValueJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-safe-resolved-values",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-safe-resolved-values__pr-number-in-run",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-safe-resolved-values");
        await harness.useFixture("no-safe-resolved-values__pr-number-in-run");
        const result = await run("Audit .github/workflows/comment.yml — is the use of github.event.pull_request.number in the run: step a script-injection vulnerability?");

        await expect(result).toSatisfyJudge(DoesNotFlagSafeResolvedValueJudge);
        await expect(result).toSatisfyJudge(ExplainsSafeResolvedValueJudge);
      },
    );

    it(
      "no-safe-resolved-values__full-sha-in-run",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-safe-resolved-values");
        await harness.useFixture("no-safe-resolved-values__full-sha-in-run");
        const result = await run("Is `echo ${{ github.event.pull_request.head.sha }}` in this workflow's run step a command injection risk?");

        await expect(result).toSatisfyJudge(DoesNotFlagSafeResolvedValueJudge);
        await expect(result).toSatisfyJudge(ExplainsSafeResolvedValueJudge);
      },
    );
  },
);
