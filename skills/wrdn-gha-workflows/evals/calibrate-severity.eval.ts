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
  PicksLowerWhenUncertainJudge,
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
      "calibrate-severity__high-pwn-request-publish",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__high-pwn-request-publish");
        const result = await run("Audit .github/workflows/release.yml and tell me the severity with reasoning.");

        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityRationaleJudge);
      },
    );

    it(
      "calibrate-severity__medium-mutable-action-with-token",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__medium-mutable-action-with-token");
        const result = await run("Review .github/workflows/build.yml and assign a severity with reasoning.");

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
        const result = await run("Audit .github/workflows/release.yml. There's a real high-severity pwn-request issue here, but also note any defense-in-depth hardening adjacent to it and rate that hardening item separately.");

        await expect(result).toSatisfyJudge(RatesLowSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityRationaleJudge);
      },
    );

    it(
      "calibrate-severity__uncertain-picks-lower",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("calibrate-severity");
        await harness.useFixture("calibrate-severity__uncertain-picks-lower");
        const result = await run("Audit .github/workflows/ci.yml. If you're unsure whether the chain is fully exploitable, pick the lower severity and explain why.");

        await expect(result).toSatisfyJudge(PicksLowerWhenUncertainJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityRationaleJudge);
      },
    );
  },
);
