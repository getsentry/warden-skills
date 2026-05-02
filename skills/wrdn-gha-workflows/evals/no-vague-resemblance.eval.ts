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
  DoesNotFabricateSinkJudge,
  DoesNotFlagVagueResemblanceJudge,
  ExplainsMissingChainJudge,
} from "./_judges.js";

const skillRoot = dirname(fileURLToPath(import.meta.url)).replace(/\/evals$/, "");

describeEval(
  "no-vague-resemblance",
  { harness: skilletHarness({ skill: skillRoot }) },
  (it) => {
    it(
      "no-vague-resemblance__looks-like-pwn-but-isnt",
      { timeout: 120_000 },
      async ({ run, behavior, harness }) => {
        behavior("no-vague-resemblance");
        await harness.useFixture("no-vague-resemblance__looks-like-pwn-but-isnt");
        const result = await run("Audit .github/workflows/triage.yml for security issues. It uses pull_request_target which I've heard is dangerous.");

        await expect(result).toSatisfyJudge(DoesNotFlagVagueResemblanceJudge);
        await expect(result).toSatisfyJudge(ExplainsMissingChainJudge);
        await expect(result).toSatisfyJudge(DoesNotFabricateSinkJudge);
      },
    );
  },
);
