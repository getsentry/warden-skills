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
  ExplainsSeverityByBlastRadiusJudge,
  RatesCriticalSeverityJudge,
  RatesHighSeverityJudge,
  RatesMediumSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "calibrate-severity-by-privilege-and-reach",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "calibrate-severity-by-privilege-and-reach__critical-write-rce",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "calibrate-severity-by-privilege-and-reach__critical-write-rce");
        const result = await run("Audit .github/workflows/release.yml and report any security findings with a severity rating.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(RatesCriticalSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityByBlastRadiusJudge);
      },
    );

    it(
      "calibrate-severity-by-privilege-and-reach__medium-read-token-leak",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "calibrate-severity-by-privilege-and-reach__medium-read-token-leak");
        const result = await run("Audit .github/workflows/pr-info.yml and report any security findings with a severity rating.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(RatesMediumSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityByBlastRadiusJudge);
      },
    );

    it(
      "calibrate-severity-by-privilege-and-reach__high-repo-mutation",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "calibrate-severity-by-privilege-and-reach__high-repo-mutation");
        const result = await run("Audit .github/workflows/label.yml and report any security findings with a severity rating.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityByBlastRadiusJudge);
      },
    );
  },
);
