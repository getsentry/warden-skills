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
  ConnectsCallerCalleeChainJudge,
  IdentifiesCalleeSinkJudge,
  RatesHighSeverityJudge,
  RecommendsCalleeHardeningJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-unsafe-reusable-and-local",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-unsafe-reusable-and-local__reusable-callee-unquoted-input",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.useFixture("report-unsafe-reusable-and-local__reusable-callee-unquoted-input");
        const result = await run("Audit the workflows under .github/workflows/ for security issues. Look at both the caller and any reusable workflows it invokes.");

        await expect(result).toSatisfyJudge(IdentifiesCalleeSinkJudge);
        await expect(result).toSatisfyJudge(ConnectsCallerCalleeChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(RecommendsCalleeHardeningJudge);
      },
    );

    it(
      "report-unsafe-reusable-and-local__composite-action-from-pr-checkout",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.useFixture("report-unsafe-reusable-and-local__composite-action-from-pr-checkout");
        const result = await run("Review .github/workflows/ci.yml and any local actions it uses for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesCalleeSinkJudge);
        await expect(result).toSatisfyJudge(ConnectsCallerCalleeChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
