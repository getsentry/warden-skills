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
  DoesNotFlagPublicReadOnlyJudge,
  IdentifiesMutableRefJudge,
  RecommendsShaPinningJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "report-supply-chain-mutable-refs",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "report-supply-chain-mutable-refs__publish-job-tag-pin",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-supply-chain-mutable-refs");
        await harness.useFixture("report-supply-chain-mutable-refs__publish-job-tag-pin");
        const result = await run("Audit .github/workflows/release.yml for security issues.");

        await expect(result).toSatisfyJudge(IdentifiesMutableRefJudge);
        await expect(result).toSatisfyJudge(ConnectsPrivilegedContextJudge);
        await expect(result).toSatisfyJudge(RecommendsShaPinningJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagFirstPartyActionsJudge);
      },
    );

    it(
      "report-supply-chain-mutable-refs__public-readonly-skip",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("report-supply-chain-mutable-refs");
        await harness.useFixture("report-supply-chain-mutable-refs__public-readonly-skip");
        const result = await run("Review .github/workflows/lint.yml for supply chain issues.");

        await expect(result).toSatisfyJudge(DoesNotFlagPublicReadOnlyJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagFirstPartyActionsJudge);
      },
    );
  },
);
