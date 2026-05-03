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
  "no-rce-claim-on-env-quoted-pattern",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "no-rce-claim-on-env-quoted-pattern__pr-title-env-quoted",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-rce-claim-on-env-quoted-pattern__pr-title-env-quoted");
        const result = await run("Audit .github/workflows/ci.yml — is the PR title handling here an injection risk?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/ci.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(DoesNotFlagEnvQuotedPatternJudge);
        await expect(result).toSatisfyJudge(ExplainsEnvQuotedSafeJudge);
      },
    );

    it(
      "no-rce-claim-on-env-quoted-pattern__broken-quoting-still-flagged",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-rce-claim-on-env-quoted-pattern__broken-quoting-still-flagged");
        const result = await run("Audit .github/workflows/ci.yml for injection risks.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/ci.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(FlagsBrokenQuotingJudge);
      },
    );
  },
);
