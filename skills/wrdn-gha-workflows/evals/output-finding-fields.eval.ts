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
  IncludesConfidenceJudge,
  IncludesFileAndLineJudge,
  IncludesTriggerInputAndImpactJudge,
  StatesNoFindingsAndListsReviewedJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "output-finding-fields",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "output-finding-fields__pwn-request-full-fields",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.useFixture("output-finding-fields__pwn-request-full-fields");
        const result = await run("Audit the workflows under .github/workflows/ for security issues and report any findings.");

        await expect(result).toSatisfyJudge(IncludesFileAndLineJudge);
        await expect(result).toSatisfyJudge(IncludesTriggerInputAndImpactJudge);
        await expect(result).toSatisfyJudge(IncludesConfidenceJudge);
        await expect(result).toSatisfyJudge(IncludesConcreteFixPatchJudge);
      },
    );

    it(
      "output-finding-fields__no-findings-lists-reviewed",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.useFixture("output-finding-fields__no-findings-lists-reviewed");
        const result = await run("Please audit the workflows in .github/workflows/ for security issues and tell me what you find.");

        await expect(result).toSatisfyJudge(StatesNoFindingsAndListsReviewedJudge);
      },
    );
  },
);
