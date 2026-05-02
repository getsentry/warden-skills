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
  DoesNotFabricateSinkJudge,
  DoesNotFlagNonIssueJudge,
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
        const result = await run("Audit .github/workflows/labeler.yml for security issues.");

        await expect(result).toSatisfyJudge(DoesNotFlagNonIssueJudge);
        await expect(result).toSatisfyJudge(ExplainsOutOfScopeJudge);
      },
    );

    it(
      "exclude-non-findings__numeric-id-in-if",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.useFixture("exclude-non-findings__numeric-id-in-if");
        const result = await run("Is there an injection risk in this workflow's if: condition?");

        await expect(result).toSatisfyJudge(DoesNotFlagNonIssueJudge);
        await expect(result).toSatisfyJudge(ExplainsOutOfScopeJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateSinkJudge);
      },
    );

    it(
      "exclude-non-findings__mutable-ref-no-secrets",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.useFixture("exclude-non-findings__mutable-ref-no-secrets");
        const result = await run("Review .github/workflows/docs.yml for supply chain risks.");

        await expect(result).toSatisfyJudge(DoesNotFlagNonIssueJudge);
        await expect(result).toSatisfyJudge(ExplainsOutOfScopeJudge);
      },
    );
  },
);
