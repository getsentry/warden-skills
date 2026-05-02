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
  IdentifiesPrivilegedTriggerJudge,
  IdentifiesTrustBoundaryJudge,
  TracesAcrossCalleesJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "trace-execution-graph",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "trace-execution-graph__composite-callee-chain",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("trace-execution-graph");
        await harness.useFixture("trace-execution-graph__composite-callee-chain");
        const result = await run("Please audit this repository's GitHub Actions for security vulnerabilities. Look at .github/workflows/ and any actions referenced. Report any exploitable findings with the full chain.");

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesTrustBoundaryJudge);
        await expect(result).toSatisfyJudge(TracesAcrossCalleesJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
      },
    );
  },
);
