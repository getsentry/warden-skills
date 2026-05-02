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
  ExplainsApprovalNotPinnedJudge,
  IdentifiesTOCTOUJudge,
  RatesHighSeverityJudge,
  RecommendsPinApprovedShaJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-toctou-approval-checkout",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-toctou-approval-checkout__ok-to-test-label-gated",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-toctou-approval-checkout");
        await harness.useFixture("report-toctou-approval-checkout__ok-to-test-label-gated");
        const result = await run("Please audit .github/workflows/integration.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesTOCTOUJudge);
        await expect(result).toSatisfyJudge(ExplainsApprovalNotPinnedJudge);
        await expect(result).toSatisfyJudge(RecommendsPinApprovedShaJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
