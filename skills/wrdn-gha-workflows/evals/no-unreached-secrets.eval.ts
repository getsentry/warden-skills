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
  DoesNotInventChainJudge,
  ExplainsSecretNotReachableJudge,
  RecognizesNoUnreachedSecretsJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-unreached-secrets",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-unreached-secrets__push-main-build-with-secret",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-unreached-secrets");
        await harness.useFixture("no-unreached-secrets__push-main-build-with-secret");
        const result = await run("Audit .github/workflows/release.yml for security issues. Are the secrets here at risk?");

        await expect(result).toSatisfyJudge(RecognizesNoUnreachedSecretsJudge);
        await expect(result).toSatisfyJudge(ExplainsSecretNotReachableJudge);
        await expect(result).toSatisfyJudge(DoesNotInventChainJudge);
      },
    );
  },
);
