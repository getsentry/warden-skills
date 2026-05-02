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
  ConnectsUntrustedInputToSinkJudge,
  FollowsUsesIntoCalleeJudge,
  IdentifiesPrivilegedTriggerJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "trace-execution-graph",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "trace-execution-graph__composite-action-sink",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("trace-execution-graph");
        await harness.useFixture("trace-execution-graph__composite-action-sink");
        const result = await run("Audit the workflows and any local actions in this repo for security issues. Trace any exploit chains end-to-end.");

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(FollowsUsesIntoCalleeJudge);
        await expect(result).toSatisfyJudge(ConnectsUntrustedInputToSinkJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
