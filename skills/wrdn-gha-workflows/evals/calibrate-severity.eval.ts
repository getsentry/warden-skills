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
  ExplainsSeverityRationaleJudge,
  PrefersLowerWhenUncertainJudge,
  RatesHighSeverityJudge,
  RatesLowSeverityJudge,
  RatesMediumSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "calibrate-severity",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "calibrate-severity__high-pr-target-checkout-with-secrets",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__high-pr-target-checkout-with-secrets");
        const result = await run("Audit .github/workflows/release.yml and report any security issues with a severity rating.");

        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityRationaleJudge);
      },
    );

    it(
      "calibrate-severity__medium-mutable-third-party-with-write-token",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__medium-mutable-third-party-with-write-token");
        const result = await run("Review .github/workflows/ci.yml and rate the severity of any issues you find.");

        await expect(result).toSatisfyJudge(RatesMediumSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityRationaleJudge);
      },
    );

    it(
      "calibrate-severity__low-defense-in-depth-adjacent",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__low-defense-in-depth-adjacent");
        const result = await run("Audit .github/workflows/publish.yml. The main injection issue is already understood — call out any defense-in-depth gaps adjacent to it and rate them.");

        await expect(result).toSatisfyJudge(RatesLowSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityRationaleJudge);
      },
    );

    it(
      "calibrate-severity__uncertain-prefers-lower",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__uncertain-prefers-lower");
        const result = await run("Audit .github/workflows/build.yml. Some details (like whether the called script reinterprets its arg) aren't visible. Rate severity.");

        await expect(result).toSatisfyJudge(PrefersLowerWhenUncertainJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityRationaleJudge);
      },
    );
  },
);
