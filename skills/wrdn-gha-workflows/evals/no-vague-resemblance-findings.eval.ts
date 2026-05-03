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
  DoesNotFlagOnResemblanceJudge,
  ExplainsNoConcreteTraceJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-vague-resemblance-findings",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "no-vague-resemblance-findings__pr-target-no-checkout",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-vague-resemblance-findings__pr-target-no-checkout");
        const result = await run("Audit .github/workflows/ci.yml. Is there a pwn-request style vulnerability here?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/ci.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DoesNotFlagOnResemblanceJudge);
        await expect(result).toSatisfyJudge(ExplainsNoConcreteTraceJudge);
      },
    );
  },
);
