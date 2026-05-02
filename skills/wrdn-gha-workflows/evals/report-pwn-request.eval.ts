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
  ConnectsExploitChainJudge,
  IdentifiesPrivilegedTriggerJudge,
  IncludesFileAndLineJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-pwn-request",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-pwn-request__pr-target-checkout-build",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-pwn-request");
        await harness.useFixture("report-pwn-request__pr-target-checkout-build");
        const result = await run("Audit the workflows in .github/workflows/ for security vulnerabilities.");

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(IncludesFileAndLineJudge);
      },
    );

    it(
      "report-pwn-request__workflow-run-artifact-execution",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-pwn-request");
        await harness.useFixture("report-pwn-request__workflow-run-artifact-execution");
        const result = await run("Please review .github/workflows/deploy.yml for any security issues.");

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
        await expect(result).toSatisfyJudge(IncludesFileAndLineJudge);
      },
    );
  },
);
