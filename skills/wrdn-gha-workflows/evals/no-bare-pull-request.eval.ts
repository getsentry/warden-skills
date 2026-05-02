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
  DoesNotFlagBarePullRequestJudge,
  ExplainsBarePullRequestSafeJudge,
  IdentifiesArtifactHandoffJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-bare-pull-request",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-bare-pull-request__plain-test-workflow",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-bare-pull-request");
        await harness.useFixture("no-bare-pull-request__plain-test-workflow");
        const result = await run("Audit .github/workflows/test.yml for security issues.");

        await expect(result).toSatisfyJudge(DoesNotFlagBarePullRequestJudge);
        await expect(result).toSatisfyJudge(ExplainsBarePullRequestSafeJudge);
      },
    );

    it(
      "no-bare-pull-request__artifact-handoff-to-workflow-run",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-bare-pull-request");
        await harness.useFixture("no-bare-pull-request__artifact-handoff-to-workflow-run");
        const result = await run("Audit the workflows in .github/workflows/ for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesArtifactHandoffJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
