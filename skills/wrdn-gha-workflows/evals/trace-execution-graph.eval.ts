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
  FollowsReusableWorkflowJudge,
  IdentifiesPrivilegedTriggerJudge,
  IdentifiesTrustBoundaryJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "trace-execution-graph",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "trace-execution-graph__reusable-callee-chain",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("trace-execution-graph");
        await harness.useFixture("trace-execution-graph__reusable-callee-chain");
        const result = await run("Audit the workflows in .github/workflows/ for security issues. Trace the full execution graph across files before reporting.");

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(FollowsReusableWorkflowJudge);
        await expect(result).toSatisfyJudge(IdentifiesTrustBoundaryJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
