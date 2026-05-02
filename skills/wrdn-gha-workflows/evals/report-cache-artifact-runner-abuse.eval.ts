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
  IdentifiesCachePoisoningJudge,
  IdentifiesSelfHostedRunnerAbuseJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-cache-artifact-runner-abuse",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-cache-artifact-runner-abuse__cache-poisoning-restore",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-cache-artifact-runner-abuse");
        await harness.useFixture("report-cache-artifact-runner-abuse__cache-poisoning-restore");
        const result = await run("Audit the workflows in .github/workflows/ for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesCachePoisoningJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "report-cache-artifact-runner-abuse__self-hosted-pr-execution",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-cache-artifact-runner-abuse");
        await harness.useFixture("report-cache-artifact-runner-abuse__self-hosted-pr-execution");
        const result = await run("Review .github/workflows/ci.yml for any security concerns.");

        await expect(result).toSatisfyJudge(IdentifiesSelfHostedRunnerAbuseJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
