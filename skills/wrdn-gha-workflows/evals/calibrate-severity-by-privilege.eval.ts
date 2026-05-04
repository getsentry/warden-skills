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
  toolCalls,
} from "@sentry/skillet/evals";
import {
  RatesCriticalSeverityJudge,
  RatesHighSeverityJudge,
  RatesMediumSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "calibrate-severity-by-privilege",
  {
    harness: piAiHarness({ agent: skilletAgent({ skillRoot }) }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "calibrate-severity-by-privilege__critical-publish",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "calibrate-severity-by-privilege__critical-publish");
        const result = await run("Audit .github/workflows/release.yml for security issues and rate severity.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/release.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(RatesCriticalSeverityJudge);
      },
    );

    it(
      "calibrate-severity-by-privilege__high-secret-exfil",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "calibrate-severity-by-privilege__high-secret-exfil");
        const result = await run("Audit .github/workflows/comment.yml for security issues and rate severity.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/comment.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "calibrate-severity-by-privilege__medium-readonly",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "calibrate-severity-by-privilege__medium-readonly");
        const result = await run("Audit .github/workflows/lint.yml for security issues and rate severity.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/lint.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(RatesMediumSeverityJudge);
      },
    );
  },
);
