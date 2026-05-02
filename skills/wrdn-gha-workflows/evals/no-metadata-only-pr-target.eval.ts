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
  ExplainsNoCheckoutOrCodeExecutionJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-metadata-only-pr-target",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-metadata-only-pr-target__auto-label",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-metadata-only-pr-target");
        await harness.useFixture("no-metadata-only-pr-target__auto-label");
        const result = await run("Please audit .github/workflows/label.yml for security issues and tell me if there's anything to worry about.");

        await expect(result).toSatisfyJudge(DoesNotFlagMetadataOnlyPrTargetJudge);
        await expect(result).toSatisfyJudge(ExplainsNoCheckoutOrCodeExecutionJudge);
      },
    );

    it(
      "no-metadata-only-pr-target__welcome-comment",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-metadata-only-pr-target");
        await harness.useFixture("no-metadata-only-pr-target__welcome-comment");
        const result = await run("Is there a pwn-request risk in .github/workflows/welcome.yml?");

        await expect(result).toSatisfyJudge(DoesNotFlagMetadataOnlyPrTargetJudge);
        await expect(result).toSatisfyJudge(ExplainsNoCheckoutOrCodeExecutionJudge);
      },
    );
  },
);
