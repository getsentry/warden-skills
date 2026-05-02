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
  DoesNotFlagYamlStyleJudge,
  IdentifiesUnsafeCalleeJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-unsafe-reusable-and-local",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-unsafe-reusable-and-local__reusable-callee-runs-pr-title",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.useFixture("report-unsafe-reusable-and-local__reusable-callee-runs-pr-title");
        const result = await run("Please audit these workflows for security issues. The caller looks fine but I want a thorough review of the whole chain.");

        await expect(result).toSatisfyJudge(IdentifiesUnsafeCalleeJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagYamlStyleJudge);
      },
    );

    it(
      "report-unsafe-reusable-and-local__local-action-from-pr-checkout",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.useFixture("report-unsafe-reusable-and-local__local-action-from-pr-checkout");
        const result = await run("Review this workflow and the local action it uses. Is there anything risky about how they interact?");

        await expect(result).toSatisfyJudge(IdentifiesUnsafeCalleeJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagYamlStyleJudge);
      },
    );
  },
);
