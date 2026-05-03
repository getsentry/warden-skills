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
  ConnectsExploitChainJudge,
  IdentifiesPrivilegedTriggerJudge,
  IdentifiesPrivilegesExposedJudge,
  IncludesFileLineJudge,
  RecommendsConcreteFixJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-with-trace-and-fix",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "report-with-trace-and-fix__pr-target-title-injection",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "report-with-trace-and-fix__pr-target-title-injection");
        const result = await run("Audit .github/workflows/triage.yml and report any security findings with full detail.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IncludesFileLineJudge);
        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(IdentifiesPrivilegesExposedJudge);
        await expect(result).toSatisfyJudge(RecommendsConcreteFixJudge);
      },
    );
  },
);
