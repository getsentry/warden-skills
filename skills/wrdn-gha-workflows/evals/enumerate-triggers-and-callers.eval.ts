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
  EnumeratesAllTriggersJudge,
  EnumeratesReusableCallersJudge,
  IdentifiesTrustBoundaryJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "enumerate-triggers-and-callers",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "enumerate-triggers-and-callers__multi-trigger-workflow",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "enumerate-triggers-and-callers__multi-trigger-workflow");
        const result = await run("Please review .github/workflows/build.yml for security issues. Walk me through the entry points first.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/build.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(EnumeratesAllTriggersJudge);
        await expect(result).toSatisfyJudge(IdentifiesTrustBoundaryJudge);
      },
    );

    it(
      "enumerate-triggers-and-callers__reusable-workflow-callers",
      { timeout: 150_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "enumerate-triggers-and-callers__reusable-workflow-callers");
        const result = await run("Audit .github/workflows/deploy.yml for security issues. Be sure to account for who can reach this workflow.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/deploy.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(EnumeratesReusableCallersJudge);
        await expect(result).toSatisfyJudge(IdentifiesTrustBoundaryJudge);
      },
    );
  },
);
