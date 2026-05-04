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
  piAiHarness,
  skilletAgent,
  toolCalls,
} from "@sentry/skillet/evals";
import {
  DoesNotFlagStyleAsSecurityJudge,
  IdentifiesExpressionInjectionJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-expression-injection-in-run",
  {
    harness: piAiHarness({ agent: skilletAgent({ skillRoot }) }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-expression-injection-in-run__pr-title-in-run",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-expression-injection-in-run__pr-title-in-run");
        const result = await run("Audit .github/workflows/pr-check.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/pr-check.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesExpressionInjectionJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "flag-expression-injection-in-run__head-ref-composite",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-expression-injection-in-run__head-ref-composite");
        const result = await run("Review .github/workflows/build.yml — anything exploitable?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/build.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesExpressionInjectionJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagStyleAsSecurityJudge);
      },
    );
  },
);
