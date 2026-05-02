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
  DoesNotFabricateSinkJudge,
  ExplainsNoCheckoutOrExecutionJudge,
  RecognizesNoMetadataOnlyPwnRequestJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-metadata-only-pr-target",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-metadata-only-pr-target__labeler",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-metadata-only-pr-target");
        await harness.useFixture("no-metadata-only-pr-target__labeler");
        const result = await run("Please audit .github/workflows/labeler.yml for any security issues with this pull_request_target workflow.");

        await expect(result).toSatisfyJudge(RecognizesNoMetadataOnlyPwnRequestJudge);
        await expect(result).toSatisfyJudge(ExplainsNoCheckoutOrExecutionJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateSinkJudge);
      },
    );

    it(
      "no-metadata-only-pr-target__welcome-comment",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-metadata-only-pr-target");
        await harness.useFixture("no-metadata-only-pr-target__welcome-comment");
        const result = await run("Is there any pwn-request risk in this workflow? Audit .github/workflows/welcome.yml.");

        await expect(result).toSatisfyJudge(RecognizesNoMetadataOnlyPwnRequestJudge);
        await expect(result).toSatisfyJudge(ExplainsNoCheckoutOrExecutionJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateSinkJudge);
      },
    );
  },
);
