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
  describeEval,
  skilletHarness,
} from "@sentry/skillet/evals";
import {
  DoesNotFabricateEvidenceJudge,
  DropsOrRatesMediumJudge,
  IdentifiesMissingLinkJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "drop-or-medium-when-untraceable",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "drop-or-medium-when-untraceable__missing-called-workflow",
      { timeout: 180_000 },
      async ({ run, behavior, harness }) => {
        behavior("drop-or-medium-when-untraceable");
        await harness.useFixture("drop-or-medium-when-untraceable__missing-called-workflow");
        const result = await run("Audit .github/workflows/ci.yml for security issues.");

        await expect(result).toSatisfyJudge(DropsOrRatesMediumJudge);
        await expect(result).toSatisfyJudge(IdentifiesMissingLinkJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateEvidenceJudge);
      },
    );
  },
);
