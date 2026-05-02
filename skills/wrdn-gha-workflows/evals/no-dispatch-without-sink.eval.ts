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
  DoesNotRecommendSinkHardeningJudge,
  ExplainsNoExploitablePathJudge,
  RecognizesNoDispatchSinkJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-dispatch-without-sink",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-dispatch-without-sink__dispatch-choice-echo",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-dispatch-without-sink");
        await harness.useFixture("no-dispatch-without-sink__dispatch-choice-echo");
        const result = await run("Audit .github/workflows/release.yml — is there any injection or RCE risk here?");

        await expect(result).toSatisfyJudge(RecognizesNoDispatchSinkJudge);
        await expect(result).toSatisfyJudge(ExplainsNoExploitablePathJudge);
        await expect(result).toSatisfyJudge(DoesNotRecommendSinkHardeningJudge);
      },
    );

    it(
      "no-dispatch-without-sink__schedule-no-input",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-dispatch-without-sink");
        await harness.useFixture("no-dispatch-without-sink__schedule-no-input");
        const result = await run("Review .github/workflows/nightly.yml for security issues.");

        await expect(result).toSatisfyJudge(RecognizesNoDispatchSinkJudge);
        await expect(result).toSatisfyJudge(ExplainsNoExploitablePathJudge);
        await expect(result).toSatisfyJudge(DoesNotRecommendSinkHardeningJudge);
      },
    );
  },
);
