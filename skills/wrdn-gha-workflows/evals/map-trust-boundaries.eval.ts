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
  ConnectsTriggerToUntrustedContentJudge,
  DoesNotFlagStyleJudge,
  IdentifiesTrustBoundaryTransitionJudge,
  IdentifiesTrustContextPerJobJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "map-trust-boundaries",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "map-trust-boundaries__pr-target-checkout-head",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "map-trust-boundaries__pr-target-checkout-head");
        const result = await run("Map the trust boundaries for each job in .github/workflows/ci.yml. For each job state whether it's trusted or untrusted and identify any transitions.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesTrustContextPerJobJudge);
        await expect(result).toSatisfyJudge(IdentifiesTrustBoundaryTransitionJudge);
        await expect(result).toSatisfyJudge(ConnectsTriggerToUntrustedContentJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagStyleJudge);
      },
    );

    it(
      "map-trust-boundaries__workflow-run-artifact",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "map-trust-boundaries__workflow-run-artifact");
        const result = await run("Walk through the trust boundaries in .github/workflows/publish.yml job by job. Where does untrusted content enter a trusted context?", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesTrustContextPerJobJudge);
        await expect(result).toSatisfyJudge(IdentifiesTrustBoundaryTransitionJudge);
        await expect(result).toSatisfyJudge(ConnectsTriggerToUntrustedContentJudge);
      },
    );
  },
);
