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
  DoesNotFabricateEvidenceJudge,
  DoesNotFlagBarePullRequestJudge,
  ExplainsBarePullRequestSafeJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-bare-pull-request",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-bare-pull-request__plain-pr-build-test",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-bare-pull-request");
        await harness.useFixture("no-bare-pull-request__plain-pr-build-test");
        const result = await run("Audit .github/workflows/ci.yml for security issues. Is there anything risky here?");

        await expect(result).toSatisfyJudge(DoesNotFlagBarePullRequestJudge);
        await expect(result).toSatisfyJudge(ExplainsBarePullRequestSafeJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateEvidenceJudge);
      },
    );
  },
);
