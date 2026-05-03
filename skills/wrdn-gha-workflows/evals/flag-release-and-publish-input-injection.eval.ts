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
  DoesNotFlagConstrainedInputJudge,
  IdentifiesInputToSinkFlowJudge,
  RatesSupplyChainImpactJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-release-and-publish-input-injection",
  {
    harness: piAiHarness({
      createAgent: () => skilletAgent({ skillRoot }),
      tools: skilletTools({ skillRoot }),
    }),
    judgeThreshold: 0.75,
  },
  (it) => {
    it(
      "flag-release-and-publish-input-injection__dispatch-version-into-run",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-release-and-publish-input-injection__dispatch-version-into-run");
        const result = await run("Please review .github/workflows/release.yml for security issues and report any injection or supply-chain risks.", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/release.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesInputToSinkFlowJudge);
        await expect(result).toSatisfyJudge(RatesSupplyChainImpactJudge);
      },
    );

    it(
      "flag-release-and-publish-input-injection__call-tag-into-git",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-release-and-publish-input-injection__call-tag-into-git");
        const result = await run("Audit .github/workflows/publish.yml — any concerns with how the reusable workflow handles inputs?", { metadata: { cwd } });

        expect(toolCalls(result.session)).toEqual(
          expect.arrayContaining([
            expect.objectContaining({ name: "Read", arguments: expect.objectContaining({"file_path":".github/workflows/publish.yml"}) }),
          ]),
        );
        await expect(result).toSatisfyJudge(IdentifiesInputToSinkFlowJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagConstrainedInputJudge);
      },
    );
  },
);
