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
  ConnectsExploitChainJudge,
  IdentifiesPrivilegedTriggerJudge,
  RatesHighSeverityJudge,
  RecommendsTreatArtifactsAsUntrustedJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-workflow-run-artifact-and-pr-data-trust",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-workflow-run-artifact-and-pr-data-trust__artifact-execution",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-workflow-run-artifact-and-pr-data-trust__artifact-execution");
        const result = await run("Audit .github/workflows/coverage.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(RecommendsTreatArtifactsAsUntrustedJudge);
      },
    );

    it(
      "flag-workflow-run-artifact-and-pr-data-trust__pr-head-checkout-comment",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-workflow-run-artifact-and-pr-data-trust__pr-head-checkout-comment");
        const result = await run("Review .github/workflows/pr-comment.yml and report any security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(RecommendsTreatArtifactsAsUntrustedJudge);
      },
    );
  },
);
