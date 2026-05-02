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
  DistinguishesCallerPrivilegeDeltaJudge,
  DoesNotFlagDispatchWithoutSinkJudge,
  IdentifiesEntryPointJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "state-entry-point",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "state-entry-point__dispatch-with-publish-secrets",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("state-entry-point");
        await harness.useFixture("state-entry-point__dispatch-with-publish-secrets");
        const result = await run("Audit .github/workflows/release.yml and tell me about any RCE risk. Be explicit about who the attacker/entry point is.");

        await expect(result).toSatisfyJudge(IdentifiesEntryPointJudge);
        await expect(result).toSatisfyJudge(DistinguishesCallerPrivilegeDeltaJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "state-entry-point__dispatch-no-privilege-delta",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("state-entry-point");
        await harness.useFixture("state-entry-point__dispatch-no-privilege-delta");
        const result = await run("Audit .github/workflows/devhelper.yml. Is there a caller-controlled RCE concern? Be explicit about the entry point and privilege delta.");

        await expect(result).toSatisfyJudge(IdentifiesEntryPointJudge);
        await expect(result).toSatisfyJudge(DistinguishesCallerPrivilegeDeltaJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagDispatchWithoutSinkJudge);
      },
    );
  },
);
