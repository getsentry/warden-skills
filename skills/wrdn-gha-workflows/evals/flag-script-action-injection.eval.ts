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
  IdentifiesScriptInjectionSinkJudge,
  RatesHighSeverityJudge,
  RecommendsEnvVarMitigationJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-script-action-injection",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-script-action-injection__github-script-pr-title",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-script-action-injection__github-script-pr-title");
        const result = await run("Audit .github/workflows/triage.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesScriptInjectionSinkJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RecommendsEnvVarMitigationJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
