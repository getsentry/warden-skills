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
  DoesNotEscalateDispatchToRCEJudge,
  DoesNotFabricateExternalRouteJudge,
  ExplainsManualTrustBoundaryJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-dispatch-rce-without-external-route",
  { harness: skilletHarness({ skill: skillRoot }), judgeThreshold: 0.75 },
  (it) => {
    it(
      "no-dispatch-rce-without-external-route__maintainer-only-input",
      { timeout: 120_000 },
      async ({ run }) => {
        const cwd = createWorkspace(skillRoot, "no-dispatch-rce-without-external-route__maintainer-only-input");
        const result = await run("Please review .github/workflows/release.yml for security issues and rate severity.", { metadata: { cwd } });

        await expect(result).toSatisfyJudge(DoesNotEscalateDispatchToRCEJudge);
        await expect(result).toSatisfyJudge(ExplainsManualTrustBoundaryJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateExternalRouteJudge);
      },
    );
  },
);
