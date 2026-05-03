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
  DoesNotFlagEnvQuotedPatternJudge,
  ExplainsEnvQuotedSafeJudge,
  FlagsBrokenQuotingJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "check-env-vs-interpolation-mitigation",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "check-env-vs-interpolation-mitigation__quoted-env-safe",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "check-env-vs-interpolation-mitigation__quoted-env-safe");
        const result = await run("Audit .github/workflows/pr.yml for security issues. Is the PR title handling here vulnerable to expression injection?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/pr.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DoesNotFlagEnvQuotedPatternJudge);
        await expect(result).toSatisfyJudge(ExplainsEnvQuotedSafeJudge);
      },
    );

    it(
      "check-env-vs-interpolation-mitigation__broken-quoting-still-flagged",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "check-env-vs-interpolation-mitigation__broken-quoting-still-flagged");
        const result = await run("Review .github/workflows/pr.yml. Is the PR title handling safe because it uses env:?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/pr.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(FlagsBrokenQuotingJudge);
      },
    );
  },
);
