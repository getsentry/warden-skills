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
  toolCalls,
} from "@sentry/skillet/evals";
import {
  ConnectsExploitChainJudge,
  DoesNotFlagStyleAsSecurityJudge,
  IdentifiesArtifactTrustIssueJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-workflow-run-artifact-trust",
  {
    harness: piAiHarness({ agent: skilletAgent({ skillRoot }) }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-workflow-run-artifact-trust__pr-comment-artifact-exec",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-workflow-run-artifact-trust__pr-comment-artifact-exec");
        const result = await run("Audit .github/workflows/comment-pr.yml for security vulnerabilities.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/comment-pr.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesArtifactTrustIssueJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
      },
    );

    it(
      "flag-workflow-run-artifact-trust__cache-restore-as-config",
      { timeout: 180_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-workflow-run-artifact-trust__cache-restore-as-config");
        const result = await run("Review .github/workflows/deploy.yml — anything risky about how it consumes the upstream run's outputs?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/deploy.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesArtifactTrustIssueJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagStyleAsSecurityJudge);
      },
    );
  },
);
