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
      "calibrate-severity__high-pwn-request-rce",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__high-pwn-request-rce");
        const result = await run("Audit .github/workflows/ci.yml and report any security findings with a severity rating.");

        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityRationaleJudge);
      },
    );

    it(
      "calibrate-severity__medium-mutable-action-with-secrets",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__medium-mutable-action-with-secrets");
        const result = await run("Audit .github/workflows/release.yml and report findings with severity.");

        await expect(result).toSatisfyJudge(RatesMediumSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityRationaleJudge);
      },
    );

    it(
      "calibrate-severity__low-defense-in-depth",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__low-defense-in-depth");
        const result = await run("Audit .github/workflows/build.yml and report findings with severity.");

        await expect(result).toSatisfyJudge(RatesLowSeverityJudge);
        await expect(result).toSatisfyJudge(PrefersLowerWhenUncertainJudge);
      },
    );
  },
);
