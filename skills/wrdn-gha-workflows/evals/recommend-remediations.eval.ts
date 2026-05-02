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
  ConcreteMinimalPatchJudge,
  RecommendsEnvAndQuotingJudge,
  RecommendsPinnedSHAJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "recommend-remediations",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "recommend-remediations__env-quoting-and-sha-pin",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("recommend-remediations");
        await harness.useFixture("recommend-remediations__env-quoting-and-sha-pin");
        const result = await run("Audit .github/workflows/triage.yml and tell me how to fix any issues you find.");

        await expect(result).toSatisfyJudge(RecommendsEnvAndQuotingJudge);
        await expect(result).toSatisfyJudge(RecommendsPinnedSHAJudge);
        await expect(result).toSatisfyJudge(ConcreteMinimalPatchJudge);
      },
    );
  },
);
