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
  ExplainsUncertaintyWhenDowngradingJudge,
  JustifiesSeverityByImpactJudge,
  RatesHighSeverityJudge,
  RatesMediumSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "calibrate-severity",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "calibrate-severity__high-pwn-request-rce",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__high-pwn-request-rce");
        const result = await run("Audit .github/workflows/ci.yml and tell me the severity of any issue you find, with justification.");

        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(JustifiesSeverityByImpactJudge);
      },
    );

    it(
      "calibrate-severity__medium-mutable-action-with-secrets",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__medium-mutable-action-with-secrets");
        const result = await run("Review .github/workflows/deploy.yml and rate the severity of any issue, explaining why.");

        await expect(result).toSatisfyJudge(RatesMediumSeverityJudge);
        await expect(result).toSatisfyJudge(JustifiesSeverityByImpactJudge);
      },
    );

    it(
      "calibrate-severity__medium-manual-approval-gate",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__medium-manual-approval-gate");
        const result = await run("What's the severity of any issue in .github/workflows/release.yml? Justify your call.");

        await expect(result).toSatisfyJudge(RatesMediumSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsUncertaintyWhenDowngradingJudge);
      },
    );
  },
);
