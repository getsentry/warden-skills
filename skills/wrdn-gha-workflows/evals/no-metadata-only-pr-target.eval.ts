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
  DoesNotFlagMetadataOnlyPrTargetJudge,
  ExplainsNoPrCodeExecutionJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-metadata-only-pr-target",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-metadata-only-pr-target__labeler-only",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-metadata-only-pr-target");
        await harness.useFixture("no-metadata-only-pr-target__labeler-only");
        const result = await run("Audit .github/workflows/labeler.yml for security issues. Is the use of pull_request_target a vulnerability?");

        await expect(result).toSatisfyJudge(DoesNotFlagMetadataOnlyPrTargetJudge);
        await expect(result).toSatisfyJudge(ExplainsNoPrCodeExecutionJudge);
      },
    );

    it(
      "no-metadata-only-pr-target__comment-on-pr",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-metadata-only-pr-target");
        await harness.useFixture("no-metadata-only-pr-target__comment-on-pr");
        const result = await run("Review .github/workflows/welcome.yml — anything exploitable about the pull_request_target trigger?");

        await expect(result).toSatisfyJudge(DoesNotFlagMetadataOnlyPrTargetJudge);
        await expect(result).toSatisfyJudge(ExplainsNoPrCodeExecutionJudge);
      },
    );
  },
);
