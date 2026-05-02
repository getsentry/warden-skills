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
  DoesNotFlagOutOfScopeJudge,
  DoesNotFlagSafeResolvedValueJudge,
  DoesNotFlagUnreachedSecretsJudge,
  DoesNotFlagYamlStyleJudge,
  ExplainsOutOfScopeJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "exclude-non-findings",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "exclude-non-findings__metadata-only-pr-target",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.useFixture("exclude-non-findings__metadata-only-pr-target");
        const result = await run("Audit .github/workflows/labeler.yml for security vulnerabilities.");

        await expect(result).toSatisfyJudge(DoesNotFlagOutOfScopeJudge);
        await expect(result).toSatisfyJudge(ExplainsOutOfScopeJudge);
      },
    );

    it(
      "exclude-non-findings__numeric-id-and-yaml-style",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.useFixture("exclude-non-findings__numeric-id-and-yaml-style");
        const result = await run("Review .github/workflows/comment.yml — anything to worry about?");

        await expect(result).toSatisfyJudge(DoesNotFlagSafeResolvedValueJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagYamlStyleJudge);
        await expect(result).toSatisfyJudge(ExplainsOutOfScopeJudge);
      },
    );

    it(
      "exclude-non-findings__secrets-in-isolated-job",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.useFixture("exclude-non-findings__secrets-in-isolated-job");
        const result = await run("Check .github/workflows/release.yml for security issues.");

        await expect(result).toSatisfyJudge(DoesNotFlagUnreachedSecretsJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagOutOfScopeJudge);
        await expect(result).toSatisfyJudge(ExplainsOutOfScopeJudge);
      },
    );
  },
);
