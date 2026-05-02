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
  IdentifiesChatopsTriggerJudge,
  IdentifiesCommentInjectionSinkJudge,
  IdentifiesMissingAuthGateJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-comment-chatops",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-comment-chatops__issue-comment-shell-injection",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-comment-chatops");
        await harness.useFixture("report-comment-chatops__issue-comment-shell-injection");
        const result = await run("Please audit .github/workflows/chatops.yml and report any security issues.");

        await expect(result).toSatisfyJudge(IdentifiesChatopsTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesMissingAuthGateJudge);
        await expect(result).toSatisfyJudge(IdentifiesCommentInjectionSinkJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "report-comment-chatops__discussion-title-injection",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-comment-chatops");
        await harness.useFixture("report-comment-chatops__discussion-title-injection");
        const result = await run("Review .github/workflows/discussion.yml for security problems.");

        await expect(result).toSatisfyJudge(IdentifiesChatopsTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesCommentInjectionSinkJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
