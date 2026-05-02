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
  IdentifiesScriptInjectionJudge,
  IncludesFixCodeJudge,
  RatesHighSeverityJudge,
  RecommendsEnvWithQuotingJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "recommend-remediations",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "recommend-remediations__pr-title-injection-env-quote",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("recommend-remediations");
        await harness.useFixture("recommend-remediations__pr-title-injection-env-quote");
        const result = await run("Audit .github/workflows/triage.yml and report any security issues with concrete fixes.");

        await expect(result).toSatisfyJudge(IdentifiesScriptInjectionJudge);
        await expect(result).toSatisfyJudge(RecommendsEnvWithQuotingJudge);
        await expect(result).toSatisfyJudge(IncludesFixCodeJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
