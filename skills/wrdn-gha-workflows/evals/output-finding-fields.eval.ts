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
  IncludesConfidenceWithReasonJudge,
  IncludesEntryPointAndInputJudge,
  IncludesExecutionAndPrivilegesJudge,
  IncludesFileAndLineJudge,
  IncludesMinimalPatchFixJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "output-finding-fields",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "output-finding-fields__pr-target-script-injection",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("output-finding-fields");
        await harness.useFixture("output-finding-fields__pr-target-script-injection");
        const result = await run("Audit .github/workflows/pr-check.yml for security issues and report any findings with full details.");

        await expect(result).toSatisfyJudge(IncludesFileAndLineJudge);
        await expect(result).toSatisfyJudge(IncludesEntryPointAndInputJudge);
        await expect(result).toSatisfyJudge(IncludesExecutionAndPrivilegesJudge);
        await expect(result).toSatisfyJudge(IncludesConfidenceWithReasonJudge);
        await expect(result).toSatisfyJudge(IncludesMinimalPatchFixJudge);
      },
    );
  },
);
