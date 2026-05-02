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
  DoesNotFlagDispatchWithoutSinkJudge,
  ExplainsNoExploitablePathJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-dispatch-without-sink",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-dispatch-without-sink__dispatch-echo-choice",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-dispatch-without-sink");
        await harness.useFixture("no-dispatch-without-sink__dispatch-echo-choice");
        const result = await run("Please audit .github/workflows/release.yml for security issues.");

        await expect(result).toSatisfyJudge(DoesNotFlagDispatchWithoutSinkJudge);
        await expect(result).toSatisfyJudge(ExplainsNoExploitablePathJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateSinkJudge);
      },
    );

    it(
      "no-dispatch-without-sink__schedule-public-fetch",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-dispatch-without-sink");
        await harness.useFixture("no-dispatch-without-sink__schedule-public-fetch");
        const result = await run("Any security risks in this scheduled workflow? See .github/workflows/nightly.yml");

        await expect(result).toSatisfyJudge(DoesNotFlagDispatchWithoutSinkJudge);
        await expect(result).toSatisfyJudge(ExplainsNoExploitablePathJudge);
      },
    );
  },
);
