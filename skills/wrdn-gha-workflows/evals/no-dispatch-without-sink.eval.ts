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
  DoesNotFabricateEvidenceJudge,
  DoesNotFlagDispatchWithoutSinkJudge,
  ExplainsNoExploitablePathJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-dispatch-without-sink",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-dispatch-without-sink__manual-deploy-no-inputs",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-dispatch-without-sink");
        await harness.useFixture("no-dispatch-without-sink__manual-deploy-no-inputs");
        const result = await run("Audit .github/workflows/deploy.yml for security issues.");

        await expect(result).toSatisfyJudge(DoesNotFlagDispatchWithoutSinkJudge);
        await expect(result).toSatisfyJudge(ExplainsNoExploitablePathJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateEvidenceJudge);
      },
    );

    it(
      "no-dispatch-without-sink__nightly-schedule-no-sink",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-dispatch-without-sink");
        await harness.useFixture("no-dispatch-without-sink__nightly-schedule-no-sink");
        const result = await run("Is there anything risky in this scheduled workflow?");

        await expect(result).toSatisfyJudge(DoesNotFlagDispatchWithoutSinkJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateEvidenceJudge);
      },
    );
  },
);
