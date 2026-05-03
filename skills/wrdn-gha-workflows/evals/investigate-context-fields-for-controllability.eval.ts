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
  piAiHarness,
  skilletAgent,
  skilletTools,
  toolCalls,
} from "@sentry/skillet/evals";
import {
  ClassifiesAttackerControlledFieldJudge,
  ClassifiesTrustedFieldJudge,
  DistinguishesCallerVsAttackerJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "investigate-context-fields-for-controllability",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "investigate-context-fields-for-controllability__pr-title-attacker-controlled",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "investigate-context-fields-for-controllability__pr-title-attacker-controlled");
        const result = await run("Audit .github/workflows/ci.yml. For each ${{ github.* }} expression you see, tell me whether it is attacker-controlled, caller-controlled, or trusted, and only flag real injection paths.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/ci.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(ClassifiesAttackerControlledFieldJudge);
        await expect(result).toSatisfyJudge(ClassifiesTrustedFieldJudge);
      },
    );

    it(
      "investigate-context-fields-for-controllability__reusable-workflow-input-caller-controlled",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "investigate-context-fields-for-controllability__reusable-workflow-input-caller-controlled");
        const result = await run("Audit .github/workflows/deploy.yml. Classify every ${{ inputs.* }} and ${{ github.* }} field as attacker-controlled, caller-controlled, or trusted, and only report findings tied to a real path.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/deploy.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DistinguishesCallerVsAttackerJudge);
        await expect(result).toSatisfyJudge(ClassifiesTrustedFieldJudge);
      },
    );
  },
);
