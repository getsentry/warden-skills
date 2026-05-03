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
  ConnectsCheckoutRefToUntrustedJudge,
  IdentifiesTrustBoundaryJudge,
  IdentifiesWorkflowRunDownloadTransitionJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "map-trust-boundaries",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "map-trust-boundaries__pr-target-checkout-head",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "map-trust-boundaries__pr-target-checkout-head");
        const result = await run("Map the trust boundaries for each job in .github/workflows/ci.yml. For every job, say whether it runs in a trusted or untrusted context and call out any transitions.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/ci.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesTrustBoundaryJudge);
        await expect(result).toSatisfyJudge(ConnectsCheckoutRefToUntrustedJudge);
      },
    );

    it(
      "map-trust-boundaries__workflow-run-artifact",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "map-trust-boundaries__workflow-run-artifact");
        const result = await run("Audit .github/workflows/comment.yml and map the trust context for each job. Flag any boundary transitions.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "read_file", arguments: expect.objectContaining({"path":".github/workflows/comment.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesTrustBoundaryJudge);
        await expect(result).toSatisfyJudge(IdentifiesWorkflowRunDownloadTransitionJudge);
      },
    );
  },
);
