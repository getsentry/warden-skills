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
  ConnectsApprovalToUnreviewedCodeJudge,
  IdentifiesTOCTOUApprovalGapJudge,
  RatesHighSeverityTOCTOUJudge,
  RecommendsPinApprovedSHAJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-toctou-approval-checkout",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-toctou-approval-checkout__label-gated-head-ref",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-toctou-approval-checkout");
        await harness.useFixture("report-toctou-approval-checkout__label-gated-head-ref");
        const result = await run("Audit .github/workflows/integration.yml for security issues and explain any vulnerabilities you find.");

        await expect(result).toSatisfyJudge(IdentifiesTOCTOUApprovalGapJudge);
        await expect(result).toSatisfyJudge(ConnectsApprovalToUnreviewedCodeJudge);
        await expect(result).toSatisfyJudge(RecommendsPinApprovedSHAJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityTOCTOUJudge);
      },
    );
  },
);
