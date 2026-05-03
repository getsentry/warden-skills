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
  createWorkspace,
  describeEval,
  piAiHarness,
  skilletAgent,
  skilletTools,
  toolCalls,
} from "@sentry/skillet/evals";
import {
  DoesNotFlagEphemeralSelfHostedJudge,
  IdentifiesSelfHostedRunnerRiskJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-self-hosted-runner-exposure",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-self-hosted-runner-exposure__pr-checkout-on-self-hosted",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-self-hosted-runner-exposure__pr-checkout-on-self-hosted");
        const result = await run("Audit .github/workflows/ci.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/ci.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesSelfHostedRunnerRiskJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "flag-self-hosted-runner-exposure__push-only-no-untrusted-path",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-self-hosted-runner-exposure__push-only-no-untrusted-path");
        const result = await run("Audit .github/workflows/release.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/release.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DoesNotFlagEphemeralSelfHostedJudge);
      },
    );
  },
);
