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
  DoesNotFlagConstrainedInputJudge,
  IdentifiesInjectionSinkJudge,
  IdentifiesSupplyChainImpactJudge,
  RatesSeverityWithExternalRouteJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "flag-release-and-publish-input-injection",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "flag-release-and-publish-input-injection__dispatch-version-in-run",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-release-and-publish-input-injection__dispatch-version-in-run");
        const result = await run("Please review .github/workflows/release.yml for security issues and tell me what you find.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesInjectionSinkJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(IdentifiesSupplyChainImpactJudge);
        await expect(result).toSatisfyJudge(RatesSeverityWithExternalRouteJudge);
        await expect(result).toSatisfyJudge(DoesNotFlagConstrainedInputJudge);
      },
    );

    it(
      "flag-release-and-publish-input-injection__workflow-call-tag-injection",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "flag-release-and-publish-input-injection__workflow-call-tag-injection");
        const result = await run("Audit .github/workflows/publish.yml — it's a reusable workflow callers use to publish packages. Anything risky?", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(IdentifiesInjectionSinkJudge);
        await expect(result).toSatisfyJudge(ConnectsExploitChainJudge);
        await expect(result).toSatisfyJudge(IdentifiesSupplyChainImpactJudge);
        await expect(result).toSatisfyJudge(RatesSeverityWithExternalRouteJudge);
      },
    );
  },
);
