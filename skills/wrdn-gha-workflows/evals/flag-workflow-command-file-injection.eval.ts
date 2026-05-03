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
  ConnectsExploitChainJudge,
  IdentifiesWorkflowCommandFileInjectionJudge,
  RatesHighSeverityJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-workflow-command-file-injection",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-workflow-command-file-injection__pr-title-to-github-env",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-workflow-command-file-injection__pr-title-to-github-env");
        const result = await run("Audit .github/workflows/release.yml for security issues.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/release.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesWorkflowCommandFileInjectionJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
      },
    );

    it(
      "flag-workflow-command-file-injection__issue-body-to-github-path",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-workflow-command-file-injection__issue-body-to-github-path");
        const result = await run("Review .github/workflows/triage.yml — anything exploitable?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/triage.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesWorkflowCommandFileInjectionJudge);
        await expect(result).toSatisfyJudge(RatesHighSeverityJudge);
      },
    );
  },
);
