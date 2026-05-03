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
  skilletHarness,
} from "@sentry/skillet/evals";
import {
  DoesNotFlagEnvQuotedPatternJudge,
  ExplainsEnvQuotedMitigationJudge,
  IdentifiesBrokenQuotingJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-rce-claim-on-env-quoted-pattern",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "no-rce-claim-on-env-quoted-pattern__safe-env-quoted",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-rce-claim-on-env-quoted-pattern__safe-env-quoted");
        const result = await run("Audit .github/workflows/pr-comment.yml for security issues. Is the way it handles the PR title risky?", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagEnvQuotedPatternJudge);
        await expect(result).toSatisfyJudge(ExplainsEnvQuotedMitigationJudge);
      },
    );

    it(
      "no-rce-claim-on-env-quoted-pattern__broken-quoting-still-flagged",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-rce-claim-on-env-quoted-pattern__broken-quoting-still-flagged");
        const result = await run("Audit .github/workflows/pr-comment.yml. Anything exploitable about how the PR title is handled?", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesBrokenQuotingJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
