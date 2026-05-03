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
  DoesNotFlagConstrainedInputJudge,
  ExplainsConstrainedInputSafeJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-rce-claim-on-constrained-inputs",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "no-rce-claim-on-constrained-inputs__choice-deploy-env",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-rce-claim-on-constrained-inputs__choice-deploy-env");
        const result = await run("Review .github/workflows/deploy.yml for security issues. Is there any RCE risk from the inputs being interpolated into the run command?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/deploy.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DoesNotFlagConstrainedInputJudge);
        await expect(result).toSatisfyJudge(ExplainsConstrainedInputSafeJudge);
      },
    );
  },
);
