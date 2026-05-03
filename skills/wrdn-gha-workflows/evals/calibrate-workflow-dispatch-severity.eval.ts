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
  DoesNotEscalateDispatchToRCEJudge,
  ExplainsManualTrustBoundaryJudge,
  IdentifiesExternalRouteToInputJudge,
  RatesHighSeverityJudge,
  RatesLowSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "calibrate-workflow-dispatch-severity",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "calibrate-workflow-dispatch-severity__plain-dispatch-low",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "calibrate-workflow-dispatch-severity__plain-dispatch-low");
        const result = await run("Audit .github/workflows/release.yml and report any security findings with severity.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(RatesLowSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsManualTrustBoundaryJudge);
        await expect(result).toSatisfyJudge(DoesNotEscalateDispatchToRCEJudge);
      },
    );

    it(
      "calibrate-workflow-dispatch-severity__reusable-from-pr",
      { timeout: 150_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "calibrate-workflow-dispatch-severity__reusable-from-pr");
        const result = await run("Audit the workflows in .github/workflows/ and report security findings with severity ratings.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(IdentifiesExternalRouteToInputJudge);
      },
    );
  },
);
