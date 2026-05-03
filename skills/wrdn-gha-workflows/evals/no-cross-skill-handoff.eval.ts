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
  DoesNotInvokeNamedSkillJudge,
  StatesIntentDirectlyJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-cross-skill-handoff",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "no-cross-skill-handoff__audit-workflow",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-cross-skill-handoff__audit-workflow");
        const result = await run("Please audit .github/workflows/ci.yml for any GitHub Actions security issues. If you'd normally call out to another skill, just do the analysis yourself.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotInvokeNamedSkillJudge);
        await expect(result).toSatisfyJudge(StatesIntentDirectlyJudge);
      },
    );
  },
);
