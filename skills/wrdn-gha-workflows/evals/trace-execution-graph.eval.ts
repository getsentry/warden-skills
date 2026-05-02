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
  ConnectsExploitChainJudge,
  FollowsReusableCalleeJudge,
  IdentifiesPrivilegedTriggerJudge,
  IncludesFileAndLineEvidenceJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "trace-execution-graph",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "trace-execution-graph__pr-target-into-composite-action",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("trace-execution-graph");
        await harness.useFixture("trace-execution-graph__pr-target-into-composite-action");
        const result = await run("Audit this repository's GitHub Actions for security issues. Trace the full execution path before reporting.");

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(FollowsReusableCalleeJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(IncludesFileAndLineEvidenceJudge);
      },
    );
  },
);
