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
  IncludesConfidenceAndPatchJudge,
  IncludesControlledInputAndExecutionJudge,
  IncludesFileLineEntryPointJudge,
  IncludesPrivilegesAndImpactJudge,
  ListsReviewedPathsWhenCleanJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "output-finding-fields",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "output-finding-fields__pwn-request-script-injection",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.useFixture("output-finding-fields__pwn-request-script-injection");
        const result = await run("Audit .github/workflows/ for security issues and report any findings with full context.");

        await expect(result).toSatisfyJudge(IncludesFileLineEntryPointJudge);
        await expect(result).toSatisfyJudge(IncludesControlledInputAndExecutionJudge);
        await expect(result).toSatisfyJudge(IncludesPrivilegesAndImpactJudge);
        await expect(result).toSatisfyJudge(IncludesConfidenceAndPatchJudge);
      },
    );

    it(
      "output-finding-fields__no-findings-lists-paths",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.useFixture("output-finding-fields__no-findings-lists-paths");
        const result = await run("Audit the workflows in .github/workflows/ for security issues. If you find nothing, tell me what you reviewed.");

        await expect(result).toSatisfyJudge(ListsReviewedPathsWhenCleanJudge);
      },
    );
  },
);
