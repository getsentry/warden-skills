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
  DoesNotFlagConstrainedInputJudge,
  ExplainsConstrainedInputSafeJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-rce-claim-on-constrained-inputs",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "no-rce-claim-on-constrained-inputs__choice-and-boolean",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-rce-claim-on-constrained-inputs__choice-and-boolean");
        const result = await run("Audit .github/workflows/deploy.yml. Are the workflow_dispatch inputs used in the run step a remote code execution risk?", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagConstrainedInputJudge);
        await expect(result).toSatisfyJudge(ExplainsConstrainedInputSafeJudge);
      },
    );
  },
);
