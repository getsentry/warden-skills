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
  DoesNotFabricateChainJudge,
  DropsOrRatesMediumJudge,
  IdentifiesMissingLinkJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "drop-or-medium-when-untraceable",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "drop-or-medium-when-untraceable__missing-reusable-workflow",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("drop-or-medium-when-untraceable");
        await harness.useFixture("drop-or-medium-when-untraceable__missing-reusable-workflow");
        const result = await run("Audit .github/workflows/ci.yml for security issues. Report findings with severity and confidence.");

        await expect(result).toSatisfyJudge(DropsOrRatesMediumJudge);
        await expect(result).toSatisfyJudge(IdentifiesMissingLinkJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateChainJudge);
      },
    );

    it(
      "drop-or-medium-when-untraceable__missing-script",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("drop-or-medium-when-untraceable");
        await harness.useFixture("drop-or-medium-when-untraceable__missing-script");
        const result = await run("Review this workflow for vulnerabilities. Provide severity and confidence for any findings.");

        await expect(result).toSatisfyJudge(DropsOrRatesMediumJudge);
        await expect(result).toSatisfyJudge(IdentifiesMissingLinkJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateChainJudge);
      },
    );
  },
);
