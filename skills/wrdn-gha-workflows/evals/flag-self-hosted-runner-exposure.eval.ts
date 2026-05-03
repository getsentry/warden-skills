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
  createWorkspace,
  describeEval,
  skilletHarness,
} from "@sentry/skillet/evals";
import {
  ConnectsExploitChainJudge,
  DoesNotFlagStyleJudge,
  IdentifiesSelfHostedRunnerJudge,
  RatesHighSeverityJudge,
  RecommendsEphemeralRunnerJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-self-hosted-runner-exposure",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-self-hosted-runner-exposure__pr-target-checkout",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-self-hosted-runner-exposure__pr-target-checkout");
        const result = await run("Audit .github/workflows/ci.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesSelfHostedRunnerJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RecommendsEphemeralRunnerJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagStyleJudge);
      },
    );
  },
);
