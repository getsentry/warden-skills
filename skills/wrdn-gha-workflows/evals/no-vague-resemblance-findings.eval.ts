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
  DoesNotFabricateSinkJudge,
  DoesNotFlagWithoutTraceJudge,
  ExplainsAbsenceOfSinkJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-vague-resemblance-findings",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "no-vague-resemblance-findings__pr-target-no-checkout",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-vague-resemblance-findings__pr-target-no-checkout");
        const result = await run("Audit .github/workflows/label.yml for security issues. Only report concrete, traced vulnerabilities.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagWithoutTraceJudge);
        await expect(result).toSatisfyJudge(ExplainsAbsenceOfSinkJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateSinkJudge);
      },
    );
  },
);
