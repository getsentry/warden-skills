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
  DoesNotFlagEnvQuotedPatternJudge,
  ExplainsEnvQuotedSafeJudge,
  VerifiesQuotingAndSinkJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "check-env-vs-interpolation-mitigation",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "check-env-vs-interpolation-mitigation__pr-title-env-quoted",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "check-env-vs-interpolation-mitigation__pr-title-env-quoted");
        const result = await run("Audit .github/workflows/pr-check.yml for expression injection or command injection risks in how the PR title is handled.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagEnvQuotedPatternJudge);
        await expect(result).toSatisfyJudge(ExplainsEnvQuotedSafeJudge);
        await expect(result).toSatisfyJudge(VerifiesQuotingAndSinkJudge);
      },
    );
  },
);
