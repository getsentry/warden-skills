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
  DoesNotFlagSanitizedWriteJudge,
  IdentifiesAttackerControlledSourceJudge,
  IdentifiesWorkflowCommandFileSinkJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-workflow-command-file-injection",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-workflow-command-file-injection__pr-title-to-github-env",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-workflow-command-file-injection__pr-title-to-github-env");
        const result = await run("Audit .github/workflows/label.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesWorkflowCommandFileSinkJudge);
        await expect(result).toSatisfyJudge(IdentifiesAttackerControlledSourceJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "flag-workflow-command-file-injection__issue-body-to-github-path",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-workflow-command-file-injection__issue-body-to-github-path");
        const result = await run("Review .github/workflows/triage.yml and report any security vulnerabilities.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesWorkflowCommandFileSinkJudge);
        await expect(result).toSatisfyJudge(IdentifiesAttackerControlledSourceJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );

    it(
      "flag-workflow-command-file-injection__hardcoded-write-not-flagged",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-workflow-command-file-injection__hardcoded-write-not-flagged");
        const result = await run("Audit .github/workflows/release.yml for security issues.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotFlagSanitizedWriteJudge);
      },
    );
  },
);
