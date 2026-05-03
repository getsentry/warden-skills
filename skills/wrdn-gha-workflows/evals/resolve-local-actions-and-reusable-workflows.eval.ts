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
  ConnectsExploitChainJudge,
  DoesNotAssumeActionSafeJudge,
  IdentifiesSinkInResolvedActionJudge,
  ResolvesLocalActionJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "resolve-local-actions-and-reusable-workflows",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "resolve-local-actions-and-reusable-workflows__composite-hidden-sink",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "resolve-local-actions-and-reusable-workflows__composite-hidden-sink");
        const result = await run("Audit the workflows and any local actions in this repo for security issues. Trace inputs end-to-end.", { metadata: { cwd } });

        const toolNames = toolCalls(result.session).map((c) => c.name);
        expect(toolNames).toEqual(expect.arrayContaining(["Read"]));
        await expect(result).toSatisfyJudge(ResolvesLocalActionJudge);
        await expect(result).toSatisfyJudge(IdentifiesSinkInResolvedActionJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(DoesNotAssumeActionSafeJudge);
      },
    );
  },
);
