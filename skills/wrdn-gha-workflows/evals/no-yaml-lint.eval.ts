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
  describeEval,
  skilletHarness,
} from "@sentry/skillet/evals";
import {
  DoesNotFlagYamlStyleJudge,
  ReportsNoSecurityFindingsJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-yaml-lint",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-yaml-lint__missing-names-and-style",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-yaml-lint");
        await harness.useFixture("no-yaml-lint__missing-names-and-style");
        const result = await run("Please do a security audit of .github/workflows/build.yml and report any security issues you find.");

        await expect(result).toSatisfyJudge(DoesNotFlagYamlStyleJudge);
        await expect(result).toSatisfyJudge(ReportsNoSecurityFindingsJudge);
      },
    );
  },
);
