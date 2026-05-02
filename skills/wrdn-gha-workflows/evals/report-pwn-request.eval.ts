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
  IdentifiesPRControlledCheckoutJudge,
  IdentifiesPrivilegedTriggerJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-pwn-request",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-pwn-request__pr-target-checkout-head",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-pwn-request");
        await harness.useFixture("report-pwn-request__pr-target-checkout-head");
        const result = await run("Audit .github/workflows/ci.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesPRControlledCheckoutJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "report-pwn-request__workflow-run-artifact-exec",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-pwn-request");
        await harness.useFixture("report-pwn-request__workflow-run-artifact-exec");
        const result = await run("Review .github/workflows/deploy.yml — anything dangerous?");

        await expect(result).toSatisfyJudge(IdentifiesPrivilegedTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesPRControlledCheckoutJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
