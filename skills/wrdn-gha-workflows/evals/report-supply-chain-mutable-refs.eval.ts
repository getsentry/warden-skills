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
  ConnectsPrivilegedContextJudge,
  DoesNotFlagFirstPartyActionsJudge,
  DoesNotFlagMutableRefJudge,
  IdentifiesMutableThirdPartyRefJudge,
  RecommendsPinToShaJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-supply-chain-mutable-refs",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-supply-chain-mutable-refs__publish-job-tag-ref",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-supply-chain-mutable-refs");
        await harness.useFixture("report-supply-chain-mutable-refs__publish-job-tag-ref");
        const result = await run("Audit .github/workflows/release.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesMutableThirdPartyRefJudge);
        await expect(result).toSatisfyJudge(ConnectsPrivilegedContextJudge);
        await expect(result).toSatisfyJudge(RecommendsPinToShaJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagFirstPartyActionsJudge);
      },
    );

    it(
      "report-supply-chain-mutable-refs__public-readonly-no-flag",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-supply-chain-mutable-refs");
        await harness.useFixture("report-supply-chain-mutable-refs__public-readonly-no-flag");
        const result = await run("Audit .github/workflows/lint.yml for supply-chain risks.");

        await expect(result).toSatisfyJudge(DoesNotFlagMutableRefJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagFirstPartyActionsJudge);
      },
    );
  },
);
