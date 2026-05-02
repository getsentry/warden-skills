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
  DoesNotFlagUnreachedSecretsJudge,
  ExplainsSecretNotReachableJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-unreached-secrets",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-unreached-secrets__scheduled-internal-job",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-unreached-secrets");
        await harness.useFixture("no-unreached-secrets__scheduled-internal-job");
        const result = await run("Audit .github/workflows/nightly.yml — anything risky about how the secret is used?");

        await expect(result).toSatisfyJudge(DoesNotFlagUnreachedSecretsJudge);
        await expect(result).toSatisfyJudge(ExplainsSecretNotReachableJudge);
      },
    );
  },
);
