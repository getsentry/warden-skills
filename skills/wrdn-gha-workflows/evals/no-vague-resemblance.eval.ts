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
  DoesNotRecommendSpeculativeFixJudge,
  ExplainsMissingChainJudge,
  RecognizesNoVagueResemblanceJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-vague-resemblance",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-vague-resemblance__looks-like-injection-but-isnt",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-vague-resemblance");
        await harness.useFixture("no-vague-resemblance__looks-like-injection-but-isnt");
        const result = await run("Audit .github/workflows/notify.yml for security vulnerabilities. I'm worried because it uses ${{ }} expressions in a run step and that looks like the injection patterns I've seen.");

        await expect(result).toSatisfyJudge(RecognizesNoVagueResemblanceJudge);
        await expect(result).toSatisfyJudge(ExplainsMissingChainJudge);
        await expect(result).toSatisfyJudge(DoesNotRecommendSpeculativeFixJudge);
      },
    );
  },
);
