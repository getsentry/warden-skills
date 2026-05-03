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
  ConnectsExploitChainJudge,
  IdentifiesChatopsTriggerJudge,
  IdentifiesCommentBodyShellInjectionJudge,
  IdentifiesMissingAuthorizationJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-chatops-without-authorization",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-chatops-without-authorization__issue-comment-shell",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-chatops-without-authorization__issue-comment-shell");
        const result = await run("Audit .github/workflows/chatops.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesChatopsTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesMissingAuthorizationJudge);
        await expect(result).toSatisfyJudge(IdentifiesCommentBodyShellInjectionJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "flag-chatops-without-authorization__label-trigger-no-auth",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-chatops-without-authorization__label-trigger-no-auth");
        const result = await run("Review .github/workflows/label-run.yml — anything risky?", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesChatopsTriggerJudge);
        await expect(result).toSatisfyJudge(IdentifiesMissingAuthorizationJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
