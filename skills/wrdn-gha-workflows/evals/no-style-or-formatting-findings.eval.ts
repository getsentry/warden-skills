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
  DoesNotFlagStyleJudge,
  ReportsCleanWhenNoExploitJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-style-or-formatting-findings",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "no-style-or-formatting-findings__style-only-workflow",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-style-or-formatting-findings__style-only-workflow");
        const result = await run("Please do a security review of .github/workflows/build.yml and report any security issues you find.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagStyleJudge);
        await expect(result).toSatisfyJudge(ReportsCleanWhenNoExploitJudge);
      },
    );
  },
);
