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
  toolCalls,
} from "@sentry/skillet/evals";
import {
  DoesNotAssumeActionSafeJudge,
  IdentifiesSinkInResolvedActionJudge,
  ResolvesLocalActionJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-skipping-action-resolution",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "no-skipping-action-resolution__local-composite-with-sink",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-skipping-action-resolution__local-composite-with-sink");
        const result = await run("Audit .github/workflows/ci.yml for security issues. Trace any attacker-controlled inputs through to sinks.", { metadata: { cwd } });

        const toolNames = toolCalls(result.session).map((c) => c.name);
        expect(toolNames).toEqual(expect.arrayContaining(["Read"]));
        await expect(result).toSatisfyJudge(ResolvesLocalActionJudge);
        await expect(result).toSatisfyJudge(IdentifiesSinkInResolvedActionJudge);
        await expect(result).toSatisfyJudge(DoesNotAssumeActionSafeJudge);
      },
    );
  },
);
