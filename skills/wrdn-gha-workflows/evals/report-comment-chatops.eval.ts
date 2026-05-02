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
  IdentifiesCommentBodyInjectionJudge,
  IdentifiesCommentTriggerJudge,
  IdentifiesMissingAuthGateJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-comment-chatops",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-comment-chatops__issue-comment-no-auth-gate",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-comment-chatops");
        await harness.useFixture("report-comment-chatops__issue-comment-no-auth-gate");
        const result = await run("Please security-audit .github/workflows/chatops.yml and report any vulnerabilities you find.");

        await expect(result).toSatisfyJudge(IdentifiesCommentTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesMissingAuthGateJudge);
        await expect(result).toSatisfyJudge(IdentifiesCommentBodyInjectionJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
      },
    );

    it(
      "report-comment-chatops__discussion-title-injection",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-comment-chatops");
        await harness.useFixture("report-comment-chatops__discussion-title-injection");
        const result = await run("Audit .github/workflows/discussion.yml for security problems.");

        await expect(result).toSatisfyJudge(IdentifiesCommentTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesCommentBodyInjectionJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
      },
    );
  },
);
