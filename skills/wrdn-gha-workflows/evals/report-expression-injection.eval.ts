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
  IdentifiesAttackerControlledSourceJudge,
  IdentifiesInjectionSinkJudge,
  RatesHighSeverityJudge,
  RecommendsEnvIndirectionJudge,
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
        const result = await run("Audit .github/workflows/issue.yml and report any security vulnerabilities you find.");

        await expect(result).toSatisfyJudge(IdentifiesInjectionSinkJudge);
        await expect(result).toSatisfyJudge(IdentifiesAttackerControlledSourceJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(RecommendsEnvIndirectionJudge);
      },
    );

    it(
      "report-expression-injection__github-script-body",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-expression-injection");
        await harness.useFixture("report-expression-injection__github-script-body");
        const result = await run("Review .github/workflows/comment.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesInjectionSinkJudge);
        await expect(result).toSatisfyJudge(IdentifiesAttackerControlledSourceJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(RecommendsEnvIndirectionJudge);
      },
    );

    it(
      "report-expression-injection__github-env-write",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-expression-injection");
        await harness.useFixture("report-expression-injection__github-env-write");
        const result = await run("Check .github/workflows/release.yml for any injection vulnerabilities.");

        await expect(result).toSatisfyJudge(IdentifiesInjectionSinkJudge);
        await expect(result).toSatisfyJudge(IdentifiesAttackerControlledSourceJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(RecommendsEnvIndirectionJudge);
      },
    );
  },
);
