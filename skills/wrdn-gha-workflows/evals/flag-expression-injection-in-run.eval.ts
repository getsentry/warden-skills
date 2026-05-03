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
  createWorkspace,
  describeEval,
  skilletHarness,
} from "@sentry/skillet/evals";
import {
  IdentifiesExpressionInjectionJudge,
  IdentifiesPrivilegedTriggerJudge,
  IncludesSinkLocationJudge,
  RatesHighSeverityJudge,
  RecommendsEnvVarMitigationJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-expression-injection-in-run",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-expression-injection-in-run__pr-title-in-run",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-expression-injection-in-run__pr-title-in-run");
        const result = await run("Please audit .github/workflows/pr-check.yml for security vulnerabilities.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesExpressionInjectionJudge);
        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(IncludesSinkLocationJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(RecommendsEnvVarMitigationJudge);
      },
    );

    it(
      "flag-expression-injection-in-run__issue-comment-body",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-expression-injection-in-run__issue-comment-body");
        const result = await run("Review .github/workflows/triage.yml and report any security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesExpressionInjectionJudge);
        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(IncludesSinkLocationJudge);
        await expect(result).toSatisfyJudge(RecommendsEnvVarMitigationJudge);
      },
    );
  },
);
