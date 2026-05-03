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
  ClassifiesAttackerControlledJudge,
  ClassifiesTrustedFieldJudge,
  DistinguishesControllabilityJudge,
  DoesNotFlagTrustedFieldJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "investigate-context-fields-for-controllability",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "investigate-context-fields-for-controllability__mixed-fields",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "investigate-context-fields-for-controllability__mixed-fields");
        const result = await run("Audit .github/workflows/triage.yml. For each ${{ github.* }} expression used in a run step, tell me whether it is attacker-controlled, caller-controlled, or trusted, and base any findings on that classification.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(ClassifiesAttackerControlledJudge);
        await expect(result).toSatisfyJudge(ClassifiesTrustedFieldJudge);
        await expect(result).toSatisfyJudge(DistinguishesControllabilityJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagTrustedFieldJudge);
      },
    );

    it(
      "investigate-context-fields-for-controllability__reusable-input",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "investigate-context-fields-for-controllability__reusable-input");
        const result = await run("Review .github/workflows/deploy.yml — is the inputs.environment value here attacker-controlled, caller-controlled, or trusted? Base your finding on that.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DistinguishesControllabilityJudge);
      },
    );
  },
);
