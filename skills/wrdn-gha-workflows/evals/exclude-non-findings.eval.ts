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
  DoesNotFlagFirstPartyTagRefJudge,
  DoesNotFlagOutOfScopeJudge,
  DoesNotFlagSafeResolvedValueJudge,
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
        const result = await run("Audit .github/workflows/label.yml for security vulnerabilities and report any findings.");

        await expect(result).toSatisfyJudge(DoesNotFlagOutOfScopeJudge);
        await expect(result).toSatisfyJudge(ExplainsOutOfScopeJudge);
      },
    );

    it(
      "exclude-non-findings__numeric-id-and-sha",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.useFixture("exclude-non-findings__numeric-id-and-sha");
        const result = await run("Is there an injection risk in this workflow? Audit .github/workflows/echo.yml.");

        await expect(result).toSatisfyJudge(DoesNotFlagSafeResolvedValueJudge);
        await expect(result).toSatisfyJudge(ExplainsOutOfScopeJudge);
      },
    );

    it(
      "exclude-non-findings__yaml-style-nits",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.useFixture("exclude-non-findings__yaml-style-nits");
        const result = await run("Audit .github/workflows/build.yml for security issues.");

        await expect(result).toSatisfyJudge(DoesNotFlagYamlStyleJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagOutOfScopeJudge);
      },
    );

    it(
      "exclude-non-findings__first-party-tag-ref",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.useFixture("exclude-non-findings__first-party-tag-ref");
        const result = await run("Review .github/workflows/release.yml — any risks from how actions are referenced?");

        await expect(result).toSatisfyJudge(DoesNotFlagFirstPartyTagRefJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagOutOfScopeJudge);
      },
    );

    it(
      "exclude-non-findings__hardcoded-choice-input",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("exclude-non-findings");
        await harness.useFixture("exclude-non-findings__hardcoded-choice-input");
        const result = await run("Audit .github/workflows/deploy.yml for injection or RCE risks tied to the manual input.");

        await expect(result).toSatisfyJudge(DoesNotFlagOutOfScopeJudge);
        await expect(result).toSatisfyJudge(ExplainsOutOfScopeJudge);
      },
    );
  },
);
