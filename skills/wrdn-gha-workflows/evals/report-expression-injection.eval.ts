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
  IdentifiesAttackerControlledContextJudge,
  IdentifiesExpressionInjectionSinkJudge,
  RatesHighSeverityJudge,
  RecommendsEnvAndQuotingJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-expression-injection",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-expression-injection__pr-title-in-run",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-expression-injection");
        await harness.useFixture("report-expression-injection__pr-title-in-run");
        const result = await run("Audit .github/workflows/pr-check.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesExpressionInjectionSinkJudge);
        await expect(result).toSatisfyJudge(IdentifiesAttackerControlledContextJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(RecommendsEnvAndQuotingJudge);
      },
    );

    it(
      "report-expression-injection__comment-body-in-github-script",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-expression-injection");
        await harness.useFixture("report-expression-injection__comment-body-in-github-script");
        const result = await run("Review this workflow for vulnerabilities: .github/workflows/triage.yml");

        await expect(result).toSatisfyJudge(IdentifiesExpressionInjectionSinkJudge);
        await expect(result).toSatisfyJudge(IdentifiesAttackerControlledContextJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "report-expression-injection__branch-name-to-github-env",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-expression-injection");
        await harness.useFixture("report-expression-injection__branch-name-to-github-env");
        const result = await run("Is .github/workflows/build.yml safe?");

        await expect(result).toSatisfyJudge(IdentifiesExpressionInjectionSinkJudge);
        await expect(result).toSatisfyJudge(IdentifiesAttackerControlledContextJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
