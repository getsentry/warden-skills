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
  ConnectsCallerCalleeChainJudge,
  IdentifiesUnsafeCalleeJudge,
  IncludesCalleeFileReferenceJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-unsafe-reusable-and-local",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-unsafe-reusable-and-local__reusable-callee-runs-pr-title",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.useFixture("report-unsafe-reusable-and-local__reusable-callee-runs-pr-title");
        const result = await run("Please audit this repo's GitHub Actions for security issues. Look at the caller workflow and any reusable workflows it calls.");

        await expect(result).toSatisfyJudge(IdentifiesUnsafeCalleeJudge);
        await expect(result).toSatisfyJudge(ConnectsCallerCalleeChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(IncludesCalleeFileReferenceJudge);
      },
    );

    it(
      "report-unsafe-reusable-and-local__composite-action-from-pr-checkout",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-unsafe-reusable-and-local");
        await harness.useFixture("report-unsafe-reusable-and-local__composite-action-from-pr-checkout");
        const result = await run("Audit the workflow and the local composite action it uses for security risks.");

        await expect(result).toSatisfyJudge(IdentifiesUnsafeCalleeJudge);
        await expect(result).toSatisfyJudge(ConnectsCallerCalleeChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(IncludesCalleeFileReferenceJudge);
      },
    );
  },
);
