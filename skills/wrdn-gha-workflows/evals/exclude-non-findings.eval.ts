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
  DoesNotFlagHardcodedChoiceJudge,
  DoesNotFlagMetadataOnlyJudge,
  DoesNotFlagSafeResolvedJudge,
  DoesNotFlagYamlStyleJudge,
  RecognizesNoFindingJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "exclude-non-findings",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "exclude-non-findings__metadata-only-pr-target",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.useFixture("exclude-non-findings__metadata-only-pr-target");
        const result = await run("Audit .github/workflows/label.yml for security vulnerabilities and report any exploitable findings.");

        await expect(result).toSatisfyJudge(RecognizesNoFindingJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagMetadataOnlyJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagYamlStyleJudge);
      },
    );

    it(
      "exclude-non-findings__safe-resolved-and-choice",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.useFixture("exclude-non-findings__safe-resolved-and-choice");
        const result = await run("Review .github/workflows/release.yml and report any exploitable security issues.");

        await expect(result).toSatisfyJudge(RecognizesNoFindingJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagSafeResolvedJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagHardcodedChoiceJudge);
      },
    );
  },
);
