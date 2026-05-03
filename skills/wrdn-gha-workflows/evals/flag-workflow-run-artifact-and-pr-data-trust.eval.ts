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
  ConnectsExploitChainJudge,
  IdentifiesWorkflowRunTrustViolationJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-workflow-run-artifact-and-pr-data-trust",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-workflow-run-artifact-and-pr-data-trust__artifact-download-and-execute",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-workflow-run-artifact-and-pr-data-trust__artifact-download-and-execute");
        const result = await run("Audit .github/workflows/comment-pr.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/comment-pr.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesWorkflowRunTrustViolationJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
      },
    );

    it(
      "flag-workflow-run-artifact-and-pr-data-trust__checkout-pr-head",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-workflow-run-artifact-and-pr-data-trust__checkout-pr-head");
        const result = await run("Review .github/workflows/label.yml — anything risky?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/label.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesWorkflowRunTrustViolationJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
