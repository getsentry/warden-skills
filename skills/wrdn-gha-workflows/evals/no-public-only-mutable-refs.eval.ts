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
  DoesNotFlagFirstPartyTagJudge,
  DoesNotFlagMutableRefJudge,
  ExplainsLowImpactContextJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-public-only-mutable-refs",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-public-only-mutable-refs__public-readonly-third-party",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-public-only-mutable-refs");
        await harness.useFixture("no-public-only-mutable-refs__public-readonly-third-party");
        const result = await run("Audit .github/workflows/lint.yml for security issues.");

        await expect(result).toSatisfyJudge(DoesNotFlagMutableRefJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagFirstPartyTagJudge);
        await expect(result).toSatisfyJudge(ExplainsLowImpactContextJudge);
      },
    );
  },
);
