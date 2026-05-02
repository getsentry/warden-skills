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
  IncludesConcreteFixPatchJudge,
  IncludesFileAndLineJudge,
  IncludesImpactAndConfidenceJudge,
  IncludesTriggerInputAndExecutionJudge,
  StatesNoFindingsAndListsReviewedJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "output-finding-fields",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "output-finding-fields__pwn-request-full-fields",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.useFixture("output-finding-fields__pwn-request-full-fields");
        const result = await run("Audit .github/workflows/ci.yml and report any security findings with full details.");

        await expect(result).toSatisfyJudge(IncludesFileAndLineJudge);
        await expect(result).toSatisfyJudge(IncludesTriggerInputAndExecutionJudge);
        await expect(result).toSatisfyJudge(IncludesImpactAndConfidenceJudge);
        await expect(result).toSatisfyJudge(IncludesConcreteFixPatchJudge);
      },
    );

    it(
      "output-finding-fields__no-findings-lists-reviewed",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.useFixture("output-finding-fields__no-findings-lists-reviewed");
        const result = await run("Review the workflows in .github/workflows/ for security issues.");

        await expect(result).toSatisfyJudge(StatesNoFindingsAndListsReviewedJudge);
      },
    );
  },
);
