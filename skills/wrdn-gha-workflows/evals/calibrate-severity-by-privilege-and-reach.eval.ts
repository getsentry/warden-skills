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
  ExplainsSeverityByBlastRadiusJudge,
  RatesCriticalSeverityJudge,
  RatesMediumSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "calibrate-severity-by-privilege-and-reach",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "calibrate-severity-by-privilege-and-reach__critical-write-token-rce",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "calibrate-severity-by-privilege-and-reach__critical-write-token-rce");
        const result = await run("Audit .github/workflows/release.yml for security issues and rate severity.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/release.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(RatesCriticalSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityByBlastRadiusJudge);
      },
    );

    it(
      "calibrate-severity-by-privilege-and-reach__medium-read-token-leak",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "calibrate-severity-by-privilege-and-reach__medium-read-token-leak");
        const result = await run("Audit .github/workflows/pr-check.yml and rate the severity of any issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/pr-check.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(RatesMediumSeverityJudge);
        await expect(result).toSatisfyJudge(ExplainsSeverityByBlastRadiusJudge);
      },
    );
  },
);
