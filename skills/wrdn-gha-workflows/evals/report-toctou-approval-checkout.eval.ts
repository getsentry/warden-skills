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
  IdentifiesPrivilegedTriggerJudge,
  IdentifiesTOCTOUJudge,
  RatesHighSeverityJudge,
  RecommendsSHAPinFromApprovalJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-toctou-approval-checkout",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-toctou-approval-checkout__ok-to-test-comment",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-toctou-approval-checkout");
        await harness.useFixture("report-toctou-approval-checkout__ok-to-test-comment");
        const result = await run("Audit .github/workflows/ok-to-test.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesTOCTOUJudge);
        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RecommendsSHAPinFromApprovalJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "report-toctou-approval-checkout__label-gated-head-ref",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-toctou-approval-checkout");
        await harness.useFixture("report-toctou-approval-checkout__label-gated-head-ref");
        const result = await run("Review .github/workflows/e2e.yml — is the label gate sufficient?");

        await expect(result).toSatisfyJudge(IdentifiesTOCTOUJudge);
        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RecommendsSHAPinFromApprovalJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
