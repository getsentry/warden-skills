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
  FlagsUnsafeChoiceValueJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "treat-choice-inputs-as-hardening",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "treat-choice-inputs-as-hardening__safe-choice-deploy",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "treat-choice-inputs-as-hardening__safe-choice-deploy");
        const result = await run("Audit .github/workflows/deploy.yml for security issues. Is the environment input an injection risk?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/deploy.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DoesNotFlagConstrainedInputJudge);
        await expect(result).toSatisfyJudge(ExplainsConstrainedInputSafeJudge);
      },
    );

    it(
      "treat-choice-inputs-as-hardening__unsafe-choice-value",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "treat-choice-inputs-as-hardening__unsafe-choice-value");
        const result = await run("Audit .github/workflows/run.yml. Are the choice inputs safe?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/run.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(FlagsUnsafeChoiceValueJudge);
      },
    );
  },
);
