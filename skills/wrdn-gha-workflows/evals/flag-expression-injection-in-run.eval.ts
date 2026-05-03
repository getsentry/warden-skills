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
  skilletTools,
  toolCalls,
} from "@sentry/skillet/evals";
import {
  IdentifiesExpressionInjectionJudge,
  IdentifiesPrivilegedTriggerJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-expression-injection-in-run",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-expression-injection-in-run__pr-title-into-run",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-expression-injection-in-run__pr-title-into-run");
        const result = await run("Audit .github/workflows/triage.yml for security issues. Report findings with severity, trigger, and sink.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/triage.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesExpressionInjectionJudge);
        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
      },
    );

    it(
      "flag-expression-injection-in-run__issue-comment-body",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-expression-injection-in-run__issue-comment-body");
        const result = await run("Please security-review .github/workflows/comment-bot.yml.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/comment-bot.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesExpressionInjectionJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
